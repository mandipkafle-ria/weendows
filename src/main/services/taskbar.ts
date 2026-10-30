import { BrowserWindow, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import { IPC } from '../../shared/ipc'
import { taskbarSettingsFileSchema } from '../../shared/schemas'
import type {
  TaskbarAnchor,
  TaskbarItemRef,
  TaskbarSettingsFile,
  TaskbarSettingsPatch,
  TaskbarState
} from '../../shared/types'
import { isSystemTaskbarHidden, setSystemTaskbarHidden } from '../native/system-taskbar'
import { taskbarBoundsFor } from '../windows/taskbar-bounds'
import type { AppGridService } from './app-grid-service'
import type { AppLauncher } from './app-launcher'
import type { AppScanner } from './app-scanner'
import log from './logger'
import { JsonStore } from './store'
import type { BundlePopoverService } from '../windows/popover-window'

const DEFAULT_TASKBAR_SETTINGS: TaskbarSettingsFile = {
  schema: 1,
  enabled: false,
  mode: 'overlay',
  position: 'bottom',
  theme: 'dark',
  opacity: 0.86,
  height: 48,
  showClock: true,
  showSettingsButton: true,
  items: []
}

export interface TaskbarServiceOptions {
  file: string
  scanner: Pick<AppScanner, 'list'>
  appGrid: Pick<AppGridService, 'listBundles'>
  launcher: Pick<AppLauncher, 'launch'>
  popover: Pick<BundlePopoverService, 'open'>
  onChanged?: (state: TaskbarState) => void
}

function itemKey(item: TaskbarItemRef): string {
  return item.type === 'app' ? `app:${item.appId}` : `bundle:${item.bundleId}`
}

function dedupeItems(items: readonly TaskbarItemRef[]): TaskbarItemRef[] {
  const seen = new Set<string>()
  const result: TaskbarItemRef[] = []
  for (const item of items) {
    const key = itemKey(item)
    if (seen.has(key) || result.length >= 32) {
      continue
    }
    seen.add(key)
    result.push({ ...item })
  }
  return result
}

export class TaskbarService {
  private readonly store: JsonStore<TaskbarSettingsFile>
  private readonly scanner: Pick<AppScanner, 'list'>
  private readonly appGrid: Pick<AppGridService, 'listBundles'>
  private readonly launcher: Pick<AppLauncher, 'launch'>
  private readonly popover: Pick<BundlePopoverService, 'open'>
  private readonly onChanged: ((state: TaskbarState) => void) | undefined
  private window: BrowserWindow | null = null
  private started = false
  private nativeError: string | null = null
  private reloadBlocked = false
  private readonly onDisplayChange = (): void => {
    this.apply()
  }

  constructor(options: TaskbarServiceOptions) {
    this.scanner = options.scanner
    this.appGrid = options.appGrid
    this.launcher = options.launcher
    this.popover = options.popover
    this.onChanged = options.onChanged
    this.store = new JsonStore<TaskbarSettingsFile>({
      file: options.file,
      schema: taskbarSettingsFileSchema,
      defaults: () => structuredClone(DEFAULT_TASKBAR_SETTINGS),
      debounceMs: 300,
      onCorrupt: (error, backupPath) => {
        log.warn('taskbar.json was unreadable; defaults were restored', {
          backupPath,
          error: error.message
        })
      },
      onWriteError: (error) => {
        log.error('Taskbar settings write failed', error.message)
      }
    })
  }

  async load(): Promise<void> {
    await this.store.load()
  }

  start(): void {
    if (this.started) {
      return
    }
    this.started = true
    screen.on('display-added', this.onDisplayChange)
    screen.on('display-removed', this.onDisplayChange)
    screen.on('display-metrics-changed', this.onDisplayChange)
    this.apply()
  }

  getSettings(): TaskbarSettingsFile {
    return structuredClone(this.store.get())
  }

  state(): TaskbarState {
    return {
      settings: this.getSettings(),
      apps: this.scanner.list(),
      bundles: this.appGrid.listBundles(),
      systemTaskbarHidden: isSystemTaskbarHidden(),
      nativeError: this.nativeError
    }
  }

  update(patch: TaskbarSettingsPatch): TaskbarState {
    this.reloadBlocked = false
    this.store.update((data) => {
      if (patch.enabled !== undefined) data.enabled = patch.enabled
      if (patch.mode !== undefined) data.mode = patch.mode
      if (patch.position !== undefined) data.position = patch.position
      if (patch.theme !== undefined) data.theme = patch.theme
      if (patch.opacity !== undefined) data.opacity = patch.opacity
      if (patch.height !== undefined) data.height = patch.height
      if (patch.showClock !== undefined) data.showClock = patch.showClock
      if (patch.showSettingsButton !== undefined) {
        data.showSettingsButton = patch.showSettingsButton
      }
      if (patch.items !== undefined) data.items = dedupeItems(patch.items)
    })
    this.apply()
    return this.state()
  }

  notifyChanged(): void {
    this.publish()
  }

  isSender(sender: WebContents): boolean {
    return !!this.window && !this.window.isDestroyed() && this.window.webContents === sender
  }

  async launchApp(appId: string): Promise<void> {
    await this.launcher.launch(appId)
  }

  async openBundle(bundleId: string, anchor: TaskbarAnchor): Promise<void> {
    const bundle = this.appGrid.listBundles().find((entry) => entry.id === bundleId)
    if (!bundle) {
      throw new Error('The folder no longer exists')
    }
    const window = this.window
    if (!window || window.isDestroyed()) {
      throw new Error('The taskbar is not available')
    }
    const settings = this.store.get()
    await this.popover.open({
      widgetId: bundle.gridId,
      bundleId,
      rect: anchor,
      sender: window.webContents,
      placement: settings.position === 'bottom' ? 'above' : 'below'
    })
  }

  async flush(): Promise<void> {
    await this.store.flush()
  }

  destroy(): void {
    if (this.started) {
      screen.removeListener('display-added', this.onDisplayChange)
      screen.removeListener('display-removed', this.onDisplayChange)
      screen.removeListener('display-metrics-changed', this.onDisplayChange)
      this.started = false
    }
    this.closeWindow()
    try {
      setSystemTaskbarHidden(false)
    } catch (error) {
      log.warn('Could not restore the Windows taskbar', error)
    }
    this.nativeError = null
    this.reloadBlocked = false
  }

  private apply(): void {
    const settings = this.store.get()
    if (!settings.enabled) {
      this.closeWindow()
      this.restoreSystemTaskbar()
      this.publish()
      return
    }
    if (this.reloadBlocked) {
      return
    }

    this.ensureWindow()
    this.updateBounds()
    if (settings.mode === 'replace') {
      const result = setSystemTaskbarHidden(true)
      this.nativeError = result.error
    } else {
      this.restoreSystemTaskbar()
    }
    this.publish()
  }

  private restoreSystemTaskbar(): void {
    const result = setSystemTaskbarHidden(false)
    this.nativeError = result.error
  }

  private ensureWindow(): void {
    if (this.window && !this.window.isDestroyed()) {
      return
    }

    const bounds = this.currentBounds()
    const window = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      hasShadow: false,
      title: 'HomeLayer Taskbar',
      webPreferences: {
        preload: join(__dirname, '../preload/taskbar-preload.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        spellcheck: false
      }
    })
    this.window = window

    window.setMenu(null)
    window.setAlwaysOnTop(true, 'normal')
    window.setSkipTaskbar(true)
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => event.preventDefault())
    window.webContents.on('render-process-gone', () => {
      if (this.window === window && !window.isDestroyed()) {
        window.reload()
      }
    })
    window.webContents.on('did-finish-load', () => {
      if (this.window === window && !window.isDestroyed()) {
        window.webContents.send(IPC.taskbarChanged, this.state())
        if (!window.isVisible()) {
          window.showInactive()
        }
      }
    })
    window.once('ready-to-show', () => {
      if (this.window !== window || window.isDestroyed()) {
        return
      }
      window.showInactive()
    })
    window.on('closed', () => {
      if (this.window === window) {
        this.window = null
      }
      if (this.started && !this.reloadBlocked && this.store.get().enabled) {
        setTimeout(() => {
          if (this.started && !this.reloadBlocked && this.store.get().enabled) {
            this.apply()
          }
        }, 500)
      }
    })

    const devUrl = process.env['ELECTRON_RENDERER_URL']
    const load = devUrl
      ? window.loadURL(`${devUrl.replace(/\/$/, '')}/taskbar/index.html`)
      : window.loadFile(join(__dirname, '../renderer/taskbar/index.html'))
    void load.catch((error: unknown) => {
      log.error('Could not load the taskbar window', error)
      this.nativeError = error instanceof Error ? error.message : String(error)
      this.reloadBlocked = true
      this.closeWindow()
    })
  }

  private closeWindow(): void {
    const window = this.window
    this.window = null
    if (window && !window.isDestroyed()) {
      window.destroy()
    }
  }

  private updateBounds(): void {
    if (!this.window || this.window.isDestroyed()) {
      return
    }
    this.window.setBounds(this.currentBounds())
  }

  private currentBounds(): { x: number; y: number; width: number; height: number } {
    const display = screen.getPrimaryDisplay()
    return taskbarBoundsFor(
      { bounds: display.bounds, workArea: display.workArea },
      this.store.get()
    )
  }

  private publish(): void {
    const state = this.state()
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC.taskbarChanged, state)
    }
    this.onChanged?.(state)
  }
}

export { DEFAULT_TASKBAR_SETTINGS }
