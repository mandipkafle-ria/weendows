import { app, BrowserWindow, powerMonitor, screen } from 'electron'
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CLOCK_WIDGET_HEIGHT,
  CLOCK_WIDGET_ID,
  CLOCK_WIDGET_WIDTH,
  WIDGET_PIN_INTERVAL_MS
} from '../../shared/constants'
import log from '../services/logger'
import {
  logPinStrategy,
  nativeWindowHandle,
  pinWithFallback,
  type ResolvedPinStrategy
} from '../native/desktop-layer'

export interface WidgetWindowOptions {
  widgetId: string
  x: number
  y: number
  width: number
  height: number
}

const widgetWindows = new Map<number, BrowserWindow>()
let pinResolved: ResolvedPinStrategy | null = null
let maintenanceTimer: NodeJS.Timeout | null = null
let displayDebounce: NodeJS.Timeout | null = null
let metricsTimer: NodeJS.Timeout | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })
  for (const entry of entries) {
    const from = join(source, entry.name)
    const to = join(target, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(from, to)
    } else if (entry.isFile()) {
      await writeFile(to, await readFile(from))
    }
  }
}

async function ensureBuiltinWidgets(): Promise<void> {
  const source = join(app.getAppPath(), 'resources', 'builtin-widgets', CLOCK_WIDGET_ID)
  const widgetsDir = join(app.getPath('userData'), 'widgets')
  const target = join(widgetsDir, CLOCK_WIDGET_ID)

  try {
    const info = await stat(target)
    if (info.isDirectory()) {
      return
    }
    await rm(target, { force: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  await mkdir(widgetsDir, { recursive: true })
  const temp = join(widgetsDir, `.${CLOCK_WIDGET_ID}.tmp-${process.pid}-${Date.now()}`)
  await rm(temp, { recursive: true, force: true })
  await copyDirectory(source, temp)

  try {
    await rename(temp, target)
    log.info('Installed built-in widget', { widget: CLOCK_WIDGET_ID, target })
  } catch (error) {
    await rm(temp, { recursive: true, force: true })
    try {
      await access(target)
      log.warn('Built-in widget install raced with another instance', { widget: CLOCK_WIDGET_ID })
    } catch {
      throw error
    }
  }
}

function pinWindow(win: BrowserWindow, reason: string): boolean {
  if (win.isDestroyed() || !pinResolved) {
    return false
  }

  try {
    const hwnd = nativeWindowHandle(win)
    const ok = pinWithFallback(hwnd, pinResolved.strategy, pinResolved.auto)
    const data = {
      window: win.id,
      hwnd: `0x${hwnd.toString(16)}`,
      strategy: pinResolved.strategy,
      reason,
      ok
    }
    if (reason === 'show') {
      log.info('Widget pinned', data)
    } else {
      log.debug('Widget re-pinned', data)
    }
    return ok
  } catch (error) {
    log.error('Widget pin failed', { window: win.id, reason, error })
    return false
  }
}

export function getWidgetWindows(): BrowserWindow[] {
  return [...widgetWindows.values()].filter((win) => !win.isDestroyed())
}

function repinAll(reason: string): void {
  for (const [id, win] of widgetWindows) {
    if (win.isDestroyed()) {
      widgetWindows.delete(id)
      continue
    }
    pinWindow(win, reason)
  }
}

function handleWake(): void {
  repinAll('wake')
}

function handleDisplayChange(): void {
  if (displayDebounce) {
    clearTimeout(displayDebounce)
  }
  displayDebounce = setTimeout(() => {
    displayDebounce = null
    repinAll('display')
  }, 500)
}

function stopWidgetMaintenance(): void {
  if (maintenanceTimer) {
    clearInterval(maintenanceTimer)
    maintenanceTimer = null
  }
  if (displayDebounce) {
    clearTimeout(displayDebounce)
    displayDebounce = null
  }
  if (metricsTimer) {
    clearTimeout(metricsTimer)
    metricsTimer = null
  }

  powerMonitor.removeListener('unlock-screen', handleWake)
  powerMonitor.removeListener('resume', handleWake)
  screen.removeListener('display-added', handleDisplayChange)
  screen.removeListener('display-removed', handleDisplayChange)
  screen.removeListener('display-metrics-changed', handleDisplayChange)
  app.removeListener('before-quit', stopWidgetMaintenance)
}

function startWidgetMaintenance(): void {
  if (maintenanceTimer) {
    return
  }

  powerMonitor.on('unlock-screen', handleWake)
  powerMonitor.on('resume', handleWake)
  screen.on('display-added', handleDisplayChange)
  screen.on('display-removed', handleDisplayChange)
  screen.on('display-metrics-changed', handleDisplayChange)
  app.once('before-quit', stopWidgetMaintenance)

  maintenanceTimer = setInterval(() => repinAll('interval'), WIDGET_PIN_INTERVAL_MS)
}

function logWidgetMetrics(count: number, startedAt: number): void {
  const widgetPids = new Set(
    getWidgetWindows()
      .map((win) => win.webContents.getOSProcessId())
      .filter((pid) => pid > 0)
  )

  const processes = app.getAppMetrics().map((metric) => {
    const workingSetMB = round((metric.memory?.workingSetSize ?? 0) / 1024)
    const privateMB = round((metric.memory?.privateBytes ?? 0) / 1024)
    return {
      pid: metric.pid,
      type: metric.type,
      name: metric.name,
      widget: widgetPids.has(metric.pid),
      workingSetMB,
      privateMB
    }
  })

  const widgetProcesses = processes.filter((metric) => metric.widget)
  const workingSetMB = round(widgetProcesses.reduce((sum, metric) => sum + metric.workingSetMB, 0))
  const privateMB = round(widgetProcesses.reduce((sum, metric) => sum + metric.privateMB, 0))

  log.info(
    `Widget metrics ${count} widget(s): ${JSON.stringify({
      widgetProcesses: widgetProcesses.length,
      workingSetMB,
      privateMB,
      perWidgetWorkingSetMB: count > 0 ? round(workingSetMB / count) : 0,
      perWidgetPrivateMB: count > 0 ? round(privateMB / count) : 0,
      elapsedMs: Date.now() - startedAt
    })}`
  )
  log.debug('Widget process metrics', processes)
}

function scheduleWidgetMetrics(count: number): void {
  const startedAt = Date.now()
  metricsTimer = setTimeout(() => {
    metricsTimer = null
    logWidgetMetrics(count, startedAt)
  }, 5000)
}

async function createWidgetWindow(options: WidgetWindowOptions): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
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
    title: 'HomeLayer Widget',
    webPreferences: {
      preload: join(__dirname, '../preload/shell-preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
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
  win.webContents.on('context-menu', (event) => event.preventDefault())
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) {
      log.error('Widget failed to load', { window: win.id, code, description, url })
    }
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('Widget renderer gone', { window: win.id, details })
  })

  win.on('show', () => {
    pinWindow(win, 'show')
  })
  win.once('ready-to-show', () => {
    win.showInactive()
  })
  win.on('closed', () => {
    widgetWindows.delete(win.id)
  })

  await win.loadFile(join(__dirname, '../renderer/widget-shell/index.html'), {
    query: { id: options.widgetId }
  })

  return win
}

export async function createWidgetWindows(count: number): Promise<void> {
  if (count <= 0) {
    log.info('Widget windows disabled')
    return
  }

  await ensureBuiltinWidgets()
  pinResolved = logPinStrategy()

  const display = screen.getPrimaryDisplay()
  const area = display.workArea
  log.info('Creating widget windows', {
    count,
    workArea: area,
    scaleFactor: display.scaleFactor
  })

  for (let index = 0; index < count; index += 1) {
    const column = index % 3
    const row = Math.floor(index / 3)
    const win = await createWidgetWindow({
      widgetId: CLOCK_WIDGET_ID,
      x: area.x + 48 + column * (CLOCK_WIDGET_WIDTH + 16),
      y: area.y + 48 + row * (CLOCK_WIDGET_HEIGHT + 16),
      width: CLOCK_WIDGET_WIDTH,
      height: CLOCK_WIDGET_HEIGHT
    })
    widgetWindows.set(win.id, win)
    await delay(100)
  }

  startWidgetMaintenance()
  scheduleWidgetMetrics(count)
  log.info('Widget windows created', { count })
}
