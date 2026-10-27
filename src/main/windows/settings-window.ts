import { BrowserWindow, nativeTheme } from 'electron'
import { join } from 'node:path'
import { APP_NAME, SETTINGS_WINDOW_HEIGHT, SETTINGS_WINDOW_WIDTH } from '../../shared/constants'
import log from '../services/logger'

let settingsWindow: BrowserWindow | null = null
const closeListeners = new Set<() => void>()
let rememberedSize: (() => { width: number; height: number }) | null = null
let persistSize: ((width: number, height: number) => void) | null = null

export interface SettingsWindowOptions {
  editWidgetId?: string
}

export function configureSettingsWindowSize(
  getSize: () => { width: number; height: number },
  setSize: (width: number, height: number) => void
): void {
  rememberedSize = getSize
  persistSize = setSize
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export function onSettingsWindowClosed(listener: () => void): () => void {
  closeListeners.add(listener)
  return () => closeListeners.delete(listener)
}

function loadSettings(window: BrowserWindow, editWidgetId?: string): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    const query = editWidgetId ? `?editWidget=${encodeURIComponent(editWidgetId)}` : ''
    return window.loadURL(`${devUrl.replace(/\/$/, '')}/settings/index.html${query}`)
  }
  return window.loadFile(join(__dirname, '../renderer/settings/index.html'), {
    query: editWidgetId ? { editWidget: editWidgetId } : undefined
  })
}

export function showSettingsWindow(options: SettingsWindowOptions = {}): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore()
    }
    settingsWindow.show()
    settingsWindow.focus()
    if (options.editWidgetId) {
      void loadSettings(settingsWindow, options.editWidgetId).catch((error: unknown) => {
        log.error('Failed to open AI edit view', error)
      })
    }
    return settingsWindow
  }

  const size = rememberedSize?.() ?? {
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT
  }
  const window = new BrowserWindow({
    width: Math.max(720, size.width),
    height: Math.max(520, size.height),
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0c0d10' : '#f4f5f7',
    title: `${APP_NAME} Settings`,
    webPreferences: {
      preload: join(__dirname, '../preload/settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  settingsWindow = window

  window.on('ready-to-show', () => {
    window.show()
  })

  let resizeTimer: NodeJS.Timeout | null = null
  window.on('resize', () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
    resizeTimer = setTimeout(() => {
      resizeTimer = null
      if (window.isDestroyed() || window.isMaximized() || window.isFullScreen()) {
        return
      }
      const bounds = window.getBounds()
      persistSize?.(bounds.width, bounds.height)
    }, 400)
  })

  window.on('close', () => {
    if (!window.isMaximized() && !window.isFullScreen()) {
      const bounds = window.getBounds()
      persistSize?.(bounds.width, bounds.height)
    }
  })

  window.on('closed', () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
    if (settingsWindow === window) {
      settingsWindow = null
    }
    for (const listener of closeListeners) {
      listener()
    }
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  void loadSettings(window, options.editWidgetId).catch((error: unknown) => {
    log.error('Failed to load settings window', error)
  })

  return window
}
