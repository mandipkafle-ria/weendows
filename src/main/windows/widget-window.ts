import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { WIDGET_SESSION_PARTITION } from '../../shared/constants'
import log from '../services/logger'
import type { Rect } from './layout-math'

export interface WidgetWindowOptions {
  widgetId: string
  title: string
  bounds: Rect
  focusable: boolean
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
    focusable: options.focusable,
    hasShadow: false,
    type: 'toolbar',
    title: options.title,
    webPreferences: {
      preload: join(__dirname, '../preload/shell-preload.js'),
      partition: WIDGET_SESSION_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false
    }
  })

  win.setMenu(null)
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

export async function loadWidgetShell(
  win: BrowserWindow,
  widgetId: string,
  variant: string | null
): Promise<void> {
  const query: Record<string, string> = { id: widgetId }
  if (variant) {
    query['variant'] = variant
  }
  await win.loadFile(join(__dirname, '../renderer/widget-shell/index.html'), { query })
}
