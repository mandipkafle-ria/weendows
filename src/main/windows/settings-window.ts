import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { APP_NAME, SETTINGS_WINDOW_HEIGHT, SETTINGS_WINDOW_WIDTH } from '../../shared/constants'
import log from '../services/logger'

let settingsWindow: BrowserWindow | null = null

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export function showSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore()
    }
    settingsWindow.show()
    settingsWindow.focus()
    return settingsWindow
  }

  const window = new BrowserWindow({
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0c0d10',
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

  window.on('closed', () => {
    if (settingsWindow === window) {
      settingsWindow = null
    }
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const load = devUrl
    ? window.loadURL(`${devUrl.replace(/\/$/, '')}/settings/index.html`)
    : window.loadFile(join(__dirname, '../renderer/settings/index.html'))

  void load.catch((error: unknown) => {
    log.error('Failed to load settings window', error)
  })

  return window
}
