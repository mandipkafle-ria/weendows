import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { Rect } from './layout-math'

const BADGE_WIDTH = 236
const BADGE_HEIGHT = 42

export interface WidgetBadgeOptions {
  bounds: Rect
  title: string
}

export interface WidgetBadge {
  window: BrowserWindow
  reposition: (bounds: Rect) => void
  destroy: () => void
}

function badgePosition(bounds: Rect): { x: number; y: number } {
  const display = screen.getDisplayMatching(bounds)
  const x = Math.min(
    Math.max(bounds.x + bounds.width - BADGE_WIDTH - 8, display.workArea.x),
    display.workArea.x + display.workArea.width - BADGE_WIDTH
  )
  const y = Math.min(
    Math.max(bounds.y + 8, display.workArea.y),
    display.workArea.y + display.workArea.height - BADGE_HEIGHT
  )
  return { x: Math.round(x), y: Math.round(y) }
}

function badgeHtml(title: string): string {
  const safeTitle = title
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
<style>
  html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; }
  body { font: 12px/1.3 'Segoe UI', system-ui, sans-serif; }
  .badge { box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; height: 100%; padding: 0 8px 0 10px; border: 1px solid rgba(255, 138, 128, 0.5); border-radius: 12px; background: rgba(28, 12, 16, 0.94); color: #ffeceb; box-shadow: 0 8px 24px rgba(0,0,0,0.45); }
  .dot { width: 8px; height: 8px; flex: none; border-radius: 999px; background: #ff6b5f; box-shadow: 0 0 10px rgba(255,107,95,0.8); }
  .label { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
  button { flex: none; height: 24px; padding: 0 8px; border: 1px solid rgba(255,255,255,0.16); border-radius: 7px; background: rgba(255,255,255,0.08); color: #fff; font: inherit; cursor: pointer; }
  button:hover { background: rgba(255,255,255,0.16); }
  button.danger { border-color: rgba(255,107,95,0.45); color: #ffc9c4; }
</style>
</head>
<body>
<div class="badge" title="${safeTitle}">
  <span class="dot"></span>
  <span class="label">${safeTitle}</span>
  <button type="button" id="reload">Reload</button>
  <button type="button" id="disable" class="danger">Disable</button>
</div>
<script>
  document.getElementById('reload').addEventListener('click', function () { window.badgeApi.action('reload') })
  document.getElementById('disable').addEventListener('click', function () { window.badgeApi.action('disable') })
</script>
</body>
</html>`
}

export function createWidgetBadge(options: WidgetBadgeOptions): WidgetBadge {
  const position = badgePosition(options.bounds)
  const window = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
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
    focusable: true,
    hasShadow: false,
    type: 'toolbar',
    alwaysOnTop: true,
    title: `${options.title} problem`,
    webPreferences: {
      preload: join(__dirname, '../preload/badge-preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  window.setMenu(null)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.once('ready-to-show', () => window.show())
  void window.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(badgeHtml(options.title))}`
  )

  return {
    window,
    reposition: (bounds: Rect) => {
      if (!window.isDestroyed()) {
        const next = badgePosition(bounds)
        window.setBounds({ x: next.x, y: next.y, width: BADGE_WIDTH, height: BADGE_HEIGHT })
      }
    },
    destroy: () => {
      if (!window.isDestroyed()) {
        window.destroy()
      }
    }
  }
}
