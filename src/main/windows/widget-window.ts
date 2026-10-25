import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import log from '../services/logger'
import type { Rect } from './layout-math'

export interface WidgetWindowOptions {
  widgetId: string
  title: string
  bounds: Rect
  opacity: number
}

export function createWidgetWindow(options: WidgetWindowOptions): BrowserWindow {
  const win = new BrowserWindow({
    x: options.bounds.x,
    y: options.bounds.y,
    width: options.bounds.width,
    height: options.bounds.height,
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
    focusable: false,
    hasShadow: false,
    type: 'toolbar',
    title: options.title,
    webPreferences: {
      preload: join(__dirname, '../preload/shell-preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  win.setMenu(null)
  win.setOpacity(options.opacity)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (details) => details.preventDefault())
  win.webContents.on('will-frame-navigate', (details) => {
    if (!details.url.startsWith('widget://')) {
      details.preventDefault()
    }
  })
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) {
      log.error('Widget failed to load', { window: win.id, code, description, url })
    }
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('Widget renderer gone', { window: win.id, details })
  })
  win.once('ready-to-show', () => {
    win.showInactive()
  })

  return win
}

export async function loadWidgetShell(win: BrowserWindow, widgetId: string): Promise<void> {
  await win.loadFile(join(__dirname, '../renderer/widget-shell/index.html'), {
    query: { id: widgetId }
  })
}
