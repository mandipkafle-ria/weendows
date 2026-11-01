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
  contentWidgetId?: string
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

function settingsQuery(options: SettingsWindowOptions): string {
  const params = new URLSearchParams()
  if (options.editWidgetId) {
    params.set('editWidget', options.editWidgetId)
  }
  if (options.contentWidgetId) {
    params.set('contentWidget', options.contentWidgetId)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

function loadSettings(
  window: BrowserWindow,
  query: string,
  fileQuery: Record<string, string> | undefined
): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    return window.loadURL(`${devUrl.replace(/\/$/, '')}/settings/index.html${query}`)
  }
  return window.loadFile(join(__dirname, '../renderer/settings/index.html'), {
    query: fileQuery
  })
}

export function showSettingsWindow(options: SettingsWindowOptions = {}): BrowserWindow {
  const query = settingsQuery(options)
  const fileQuery = query ? Object.fromEntries(new URLSearchParams(query)) : undefined

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore()
    }
    settingsWindow.show()
    settingsWindow.focus()
    if (query) {
      void loadSettings(settingsWindow, query, fileQuery).catch((error: unknown) => {
        log.error('Failed to refocus settings window', error)
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

  void loadSettings(window, query, fileQuery).catch((error: unknown) => {
    log.error('Failed to load settings window', error)
  })

  return window
}
