import { BrowserWindow, type Display } from 'electron'
import { join } from 'node:path'
import { WIDGET_SESSION_PARTITION } from '../../shared/constants'
import type { WallpaperFit } from '../../shared/types'
import type { UsedWallpaperStrategy } from '../native/wallpaper-attach'
import log from '../services/logger'

export interface WallpaperHostQuery {
  type: 'video' | 'html'
  src: string
  fit: WallpaperFit
  muted: boolean
}

export interface WallpaperWindow {
  win: BrowserWindow
  displayId: number
  hwnd: bigint
  parent: bigint
  strategy: UsedWallpaperStrategy
}

export function createWallpaperWindow(display: Display): BrowserWindow {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/wallpaper-preload.js'),
      partition: WIDGET_SESSION_PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  })

  win.setMenu(null)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })
  win.webContents.on('will-frame-navigate', (details) => {
    if (!details.url.startsWith('widget://')) {
      details.preventDefault()
    }
  })
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) {
      log.error('Wallpaper host failed to load', { window: win.id, code, description, url })
    }
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('Wallpaper renderer gone', { window: win.id, details })
  })

  return win
}

export async function loadWallpaperHost(
  win: BrowserWindow,
  query: WallpaperHostQuery
): Promise<void> {
  const params = {
    type: query.type,
    src: query.src,
    fit: query.fit,
    muted: query.muted ? '1' : '0'
  }
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    const search = new URLSearchParams(params)
    await win.loadURL(`${devUrl.replace(/\/$/, '')}/wallpaper-host/index.html?${search.toString()}`)
    return
  }
  await win.loadFile(join(__dirname, '../renderer/wallpaper-host/index.html'), { query: params })
}

export function nativeWindowHandle(win: BrowserWindow): bigint {
  const buffer = win.getNativeWindowHandle()
  if (buffer.length >= 8) {
    return buffer.readBigUInt64LE(0)
  }
  return BigInt(buffer.readUInt32LE(0))
}

export function setWallpaperWindowBounds(win: BrowserWindow, display: Display): void {
  win.setBounds(display.bounds)
}
