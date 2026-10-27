import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { release } from 'node:os'
import { join } from 'node:path'
import koffi from 'koffi'

type Handle = bigint
type Strategy = 'auto' | 'classic' | 'progman-child'
type UsedStrategy = Exclude<Strategy, 'auto'>

interface NativeRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface PixelRect {
  x: number
  y: number
  width: number
  height: number
}

interface LayoutInfo {
  kind: 'progman-child' | 'classic' | 'unknown'
  progman: Handle
  defView: Handle | null
  iconHost: Handle | null
  wallpaperHost: Handle | null
}

interface StyleResult {
  before: number
  after: number
}

interface PlacementResult {
  parentRect: NativeRect
  windowRect: NativeRect | null
}

interface AttachResult {
  strategy: UsedStrategy
  parent: Handle
  parentClass: string
  layout: LayoutInfo
  style: StyleResult
  placement: PlacementResult
  layerMessages: string[]
}

interface SpikeResult {
  timestamp: string
  windowsBuild: string
  systemVersion: string
  architecture: string
  electron: string
  requestedStrategy: Strategy
  usedStrategy: UsedStrategy | null
  color: string
  displays: Array<{
    id: string
    primary: boolean
    scaleFactor: number
    bounds: PixelRect
    workArea: PixelRect
  }>
  attach: AttachResult | null
  diagnostics: Record<string, unknown>
  manualChecks: string[]
  error: string | null
}

type FindWindowFunction = (className: string, windowName: string | null) => number | bigint | null
type FindWindowExFunction = (
  parent: Handle,
  childAfter: Handle,
  className: string | null,
  windowName: string | null
) => number | bigint | null
type SendMessageTimeoutFunction = (
  hwnd: Handle,
  message: number,
  wParam: Handle,
  lParam: bigint,
  flags: number,
  timeout: number,
  result: [bigint]
) => number | bigint
type GetWindowLongFunction = (hwnd: Handle, index: number) => number
type SetWindowLongFunction = (hwnd: Handle, index: number, value: number) => number
type SetParentFunction = (child: Handle, parent: Handle) => number | bigint | null
type GetParentFunction = (hwnd: Handle) => number | bigint | null
type SetWindowPosFunction = (
  hwnd: Handle,
  insertAfter: Handle,
  x: number,
  y: number,
  cx: number,
  cy: number,
  flags: number
) => number
type GetWindowRectFunction = (hwnd: Handle, rect: NativeRect) => number
type GetClassNameFunction = (hwnd: Handle, buffer: Buffer, maxCount: number) => number
type IsWindowFunction = (hwnd: Handle) => number
type IsWindowVisibleFunction = (hwnd: Handle) => number
type GetWindowFunction = (hwnd: Handle, command: number) => number | bigint | null

const user32 = koffi.load('user32.dll')
const RECT = koffi.struct('RECT', {
  left: 'int32_t',
  top: 'int32_t',
  right: 'int32_t',
  bottom: 'int32_t'
})

const findWindowW = user32.func(
  'uintptr_t __stdcall FindWindowW(str16 className, str16 windowName)'
) as FindWindowFunction
const findWindowExW = user32.func(
  'uintptr_t __stdcall FindWindowExW(uintptr_t parent, uintptr_t childAfter, str16 className, str16 windowName)'
) as FindWindowExFunction
const sendMessageTimeoutW = user32.func(
  'uintptr_t __stdcall SendMessageTimeoutW(uintptr_t hwnd, uint32_t message, uintptr_t wParam, intptr_t lParam, uint32_t flags, uint32_t timeout, _Out_ uintptr_t *result)'
) as SendMessageTimeoutFunction
const getWindowLongW = user32.func(
  'int32_t __stdcall GetWindowLongW(uintptr_t hwnd, int index)'
) as GetWindowLongFunction
const setWindowLongW = user32.func(
  'int32_t __stdcall SetWindowLongW(uintptr_t hwnd, int index, int32_t value)'
) as SetWindowLongFunction
const setParentW = user32.func(
  'uintptr_t __stdcall SetParent(uintptr_t child, uintptr_t parent)'
) as SetParentFunction
const getParentW = user32.func('uintptr_t __stdcall GetParent(uintptr_t hwnd)') as GetParentFunction
const setWindowPosW = user32.func(
  'int __stdcall SetWindowPos(uintptr_t hwnd, uintptr_t insertAfter, int x, int y, int cx, int cy, uint32_t flags)'
) as SetWindowPosFunction
const getWindowRectW = user32.func('GetWindowRect', 'int', [
  'uintptr_t',
  koffi.out(koffi.pointer(RECT))
]) as GetWindowRectFunction
const getClassNameW = user32.func(
  'int __stdcall GetClassNameW(uintptr_t hwnd, _Out_ uint16_t *buffer, int maxCount)'
) as GetClassNameFunction
const isWindowW = user32.func('int __stdcall IsWindow(uintptr_t hwnd)') as IsWindowFunction
const isWindowVisibleW = user32.func(
  'int __stdcall IsWindowVisible(uintptr_t hwnd)'
) as IsWindowVisibleFunction
const getWindowW = user32.func(
  'uintptr_t __stdcall GetWindow(uintptr_t hwnd, uint32_t command)'
) as GetWindowFunction

const GWL_STYLE = -16
const GWL_EXSTYLE = -20
const GW_HWNDNEXT = 2
const WS_CHILD = 0x40000000
const WS_POPUP = 0x80000000
const WS_EX_TOOLWINDOW = 0x00000080
const WS_EX_APPWINDOW = 0x00040000
const HWND_TOP = 0n
const SWP_NOACTIVATE = 0x0010
const SWP_FRAMECHANGED = 0x0020
const SWP_SHOWWINDOW = 0x0040
const WM_SPAWN_WORKER = 0x052c
const SMTO_NORMAL = 0
const SPIKE_SECONDS_DEFAULT = 45
const SPIKE_COLOR_DEFAULT = '#d500f9'
const OUT_DIR = join(process.cwd(), 'out')
const LOG_PATH = join(OUT_DIR, 'spike-wallpaper.log')
const RESULT_PATH = join(OUT_DIR, 'spike-wallpaper-result.json')

let spikeWindow: BrowserWindow | null = null
let finishing = false
let latestResult: SpikeResult | null = null

function logLine(message: string): void {
  console.log(message)
  appendFileSync(LOG_PATH, `${message}\n`)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeHandle(value: number | bigint | null | undefined): Handle | null {
  if (value === null || value === undefined) {
    return null
  }
  const handle = BigInt(value)
  return handle === 0n ? null : handle
}

function findWindow(className: string): Handle | null {
  return normalizeHandle(findWindowW(className, null))
}

function findWindowEx(parent: Handle, after: Handle, className: string | null): Handle | null {
  return normalizeHandle(findWindowExW(parent, after, className, null))
}

function getWindow(hwnd: Handle, command: number): Handle | null {
  return normalizeHandle(getWindowW(hwnd, command))
}

function getParent(hwnd: Handle): Handle | null {
  return normalizeHandle(getParentW(hwnd))
}

function isWindow(hwnd: Handle): boolean {
  return Boolean(isWindowW(hwnd))
}

function isWindowVisible(hwnd: Handle): boolean {
  return Boolean(isWindowVisibleW(hwnd))
}

function getWindowRect(hwnd: Handle): NativeRect | null {
  const rect: NativeRect = { left: 0, top: 0, right: 0, bottom: 0 }
  return getWindowRectW(hwnd, rect) ? rect : null
}

function getClassName(hwnd: Handle): string {
  const buffer = Buffer.alloc(512)
  const length = getClassNameW(hwnd, buffer, 256)
  return length > 0 ? buffer.toString('utf16le', 0, length * 2) : ''
}

function nativeWindowHandle(win: BrowserWindow): Handle {
  const buffer = win.getNativeWindowHandle()
  return buffer.length === 8 ? buffer.readBigUInt64LE(0) : BigInt(buffer.readUInt32LE(0))
}

function childWindows(parent: Handle): Handle[] {
  const children: Handle[] = []
  let child = findWindowEx(parent, 0n, null)
  while (child) {
    children.push(child)
    child = findWindowEx(parent, child, null)
  }
  return children
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`
  const match = process.argv.find((argument) => argument.startsWith(prefix))
  return match?.slice(prefix.length)
}

function resolveStrategy(): Strategy {
  const raw = argValue('strategy') ?? process.env.HL_WP_STRATEGY ?? 'auto'
  const value = raw.trim().toLowerCase()
  if (value === 'classic' || value === 'progman-child') {
    return value
  }
  if (value !== 'auto') {
    logLine(`Invalid strategy "${raw}"; using auto.`)
  }
  return 'auto'
}

function resolveSeconds(): number {
  const parsed = Number.parseInt(argValue('seconds') ?? process.env.HL_WP_SPIKE_SECONDS ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : SPIKE_SECONDS_DEFAULT
}

function resolveColor(): string {
  const value = argValue('color') ?? SPIKE_COLOR_DEFAULT
  return /^#[0-9a-f]{6}$/i.test(value) ? value : SPIKE_COLOR_DEFAULT
}

function detectLayout(progman: Handle): LayoutInfo {
  const progmanDefView = findWindowEx(progman, 0n, 'SHELLDLL_DefView')
  if (progmanDefView) {
    return {
      kind: 'progman-child',
      progman,
      defView: progmanDefView,
      iconHost: null,
      wallpaperHost: null
    }
  }

  let iconHost: Handle | null = null
  let worker = findWindowEx(0n, 0n, 'WorkerW')
  while (worker) {
    if (findWindowEx(worker, 0n, 'SHELLDLL_DefView')) {
      iconHost = worker
      break
    }
    worker = findWindowEx(0n, worker, 'WorkerW')
  }

  if (!iconHost) {
    return {
      kind: 'unknown',
      progman,
      defView: null,
      iconHost: null,
      wallpaperHost: null
    }
  }

  return {
    kind: 'classic',
    progman,
    defView: findWindowEx(iconHost, 0n, 'SHELLDLL_DefView'),
    iconHost,
    wallpaperHost: findWindowEx(0n, iconHost, 'WorkerW')
  }
}

function sendSpawnWorker(progman: Handle, wParam: Handle, lParam: bigint): string {
  const output: [bigint] = [0n]
  const result = sendMessageTimeoutW(
    progman,
    WM_SPAWN_WORKER,
    wParam,
    lParam,
    SMTO_NORMAL,
    1000,
    output
  )
  return `wParam=${wParam.toString()} lParam=${lParam.toString()} result=${Number(result)} output=${Number(output[0])}`
}

async function ensureDesktopLayer(progman: Handle): Promise<{
  layout: LayoutInfo
  messages: string[]
}> {
  const messages: string[] = []
  messages.push(sendSpawnWorker(progman, 0xdn, 0x1n))
  await delay(150)
  let layout = detectLayout(progman)

  if (layout.kind === 'unknown') {
    messages.push(sendSpawnWorker(progman, 0n, 0n))
    await delay(150)
    layout = detectLayout(progman)
  }

  return { layout, messages }
}

function makeChildStyle(hwnd: Handle): StyleResult {
  const before = getWindowLongW(hwnd, GWL_STYLE) >>> 0
  const next = (before & ~WS_POPUP) | WS_CHILD | 0
  setWindowLongW(hwnd, GWL_STYLE, next)
  const after = getWindowLongW(hwnd, GWL_STYLE) >>> 0

  if ((after & WS_CHILD) === 0 || (after & WS_POPUP) !== 0) {
    throw new Error(
      `Could not switch the window to a child style (before=0x${before.toString(16)}, after=0x${after.toString(16)})`
    )
  }

  return { before, after }
}

function placeRelative(
  parent: Handle,
  hwnd: Handle,
  rectPx: PixelRect,
  insertAfter: Handle
): PlacementResult {
  const parentRect = getWindowRect(parent)
  if (!parentRect) {
    throw new Error('Could not read the desktop parent rectangle')
  }

  const flags = SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW
  const placed = setWindowPosW(
    hwnd,
    insertAfter,
    rectPx.x - parentRect.left,
    rectPx.y - parentRect.top,
    rectPx.width,
    rectPx.height,
    flags
  )
  if (!placed) {
    throw new Error('SetWindowPos failed')
  }

  return {
    parentRect,
    windowRect: getWindowRect(hwnd)
  }
}

async function attachToDesktop(
  hwnd: Handle,
  rectPx: PixelRect,
  requested: Strategy
): Promise<AttachResult> {
  if (process.platform !== 'win32') {
    throw new Error('The wallpaper spike only runs on Windows')
  }

  const progman = findWindow('Progman')
  if (!progman) {
    throw new Error('Progman was not found; Explorer may not be running')
  }

  const layer = await ensureDesktopLayer(progman)
  const candidates: UsedStrategy[] =
    requested === 'auto'
      ? layer.layout.kind === 'progman-child'
        ? ['progman-child', 'classic']
        : layer.layout.kind === 'classic'
          ? ['classic', 'progman-child']
          : ['progman-child', 'classic']
      : [requested]

  let lastError: Error | null = null

  for (const strategy of candidates) {
    try {
      if (strategy === 'classic') {
        if (!layer.layout.iconHost || !layer.layout.wallpaperHost) {
          throw new Error('Classic layout needs a WorkerW host behind the icon WorkerW')
        }
        const style = makeChildStyle(hwnd)
        setParentW(hwnd, layer.layout.wallpaperHost)
        if (getParent(hwnd) !== layer.layout.wallpaperHost) {
          throw new Error('SetParent did not stick for the classic WorkerW host')
        }
        const placement = placeRelative(layer.layout.wallpaperHost, hwnd, rectPx, HWND_TOP)
        return {
          strategy,
          parent: layer.layout.wallpaperHost,
          parentClass: getClassName(layer.layout.wallpaperHost),
          layout: layer.layout,
          style,
          placement,
          layerMessages: layer.messages
        }
      }

      if (!layer.layout.defView) {
        throw new Error('Progman-child layout needs SHELLDLL_DefView under Progman')
      }
      const defView = layer.layout.defView
      const style = makeChildStyle(hwnd)
      setParentW(hwnd, progman)
      if (getParent(hwnd) !== progman) {
        throw new Error('SetParent did not stick for Progman')
      }
      const placement = placeRelative(progman, hwnd, rectPx, defView)
      return {
        strategy,
        parent: progman,
        parentClass: getClassName(progman),
        layout: layer.layout,
        style,
        placement,
        layerMessages: layer.messages
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      logLine(`Attach attempt failed (${strategy}): ${lastError.message}`)
    }
  }

  throw lastError ?? new Error('No wallpaper attach strategy was available')
}

function collectDiagnostics(hwnd: Handle, attach: AttachResult): Record<string, unknown> {
  const defView = attach.layout.defView
  const iconHost = attach.layout.iconHost
  const taskbar = findWindow('Shell_TrayWnd')
  const children = childWindows(attach.parent)
  const exStyle = getWindowLongW(hwnd, GWL_EXSTYLE) >>> 0
  const nextBelowIconHost = iconHost ? getWindow(iconHost, GW_HWNDNEXT) : null

  return {
    parentClass: attach.parentClass,
    parentHandle: `0x${attach.parent.toString(16)}`,
    windowHandle: `0x${hwnd.toString(16)}`,
    parentIsWindow: isWindow(attach.parent),
    windowIsWindow: isWindow(hwnd),
    windowVisible: isWindowVisible(hwnd),
    parentMatches: getParent(hwnd) === attach.parent,
    style: {
      before: `0x${attach.style.before.toString(16)}`,
      after: `0x${attach.style.after.toString(16)}`,
      child: (attach.style.after & WS_CHILD) !== 0,
      popup: (attach.style.after & WS_POPUP) !== 0
    },
    extendedStyle: {
      value: `0x${exStyle.toString(16)}`,
      toolWindow: (exStyle & WS_EX_TOOLWINDOW) !== 0,
      appWindow: (exStyle & WS_EX_APPWINDOW) !== 0
    },
    rects: {
      parent: attach.placement.parentRect,
      window: attach.placement.windowRect
    },
    desktopLayer: {
      kind: attach.layout.kind,
      messages: attach.layerMessages,
      defView: defView ? `0x${defView.toString(16)}` : null,
      defViewVisible: defView ? isWindowVisible(defView) : null,
      iconHost: iconHost ? `0x${iconHost.toString(16)}` : null,
      iconHostVisible: iconHost ? isWindowVisible(iconHost) : null,
      nextBelowIconHost: nextBelowIconHost ? `0x${nextBelowIconHost.toString(16)}` : null,
      nextBelowIsParent: nextBelowIconHost === attach.parent,
      childCount: children.length,
      childClasses: children.map(getClassName),
      windowChildIndex: children.indexOf(hwnd),
      defViewChildIndex: defView ? children.indexOf(defView) : -1
    },
    taskbar: {
      handle: taskbar ? `0x${taskbar.toString(16)}` : null,
      visible: taskbar ? isWindowVisible(taskbar) : null
    }
  }
}

function displayInfo(): SpikeResult['displays'] {
  const primaryId = String(screen.getPrimaryDisplay().id)
  return screen.getAllDisplays().map((display) => ({
    id: String(display.id),
    primary: String(display.id) === primaryId,
    scaleFactor: display.scaleFactor,
    bounds: { ...display.bounds },
    workArea: { ...display.workArea }
  }))
}

function writeResult(result: SpikeResult): void {
  latestResult = result
  const json = JSON.stringify(
    result,
    (_key, value: unknown) => (typeof value === 'bigint' ? `0x${value.toString(16)}` : value),
    2
  )
  writeFileSync(RESULT_PATH, `${json}\n`)
}

function finish(code: number): void {
  if (finishing) {
    return
  }
  finishing = true
  globalShortcut.unregisterAll()
  if (spikeWindow && !spikeWindow.isDestroyed()) {
    spikeWindow.destroy()
  }
  app.exit(code)
}

async function run(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(LOG_PATH, '')
  logLine('HomeLayer Phase 6B wallpaper spike')
  logLine(`Windows build: ${release()} (${process.arch})`)
  logLine(`Electron: ${process.versions.electron}`)
  logLine(`Log: ${LOG_PATH}`)
  logLine(`Result: ${RESULT_PATH}`)

  const requestedStrategy = resolveStrategy()
  const seconds = resolveSeconds()
  const color = resolveColor()
  const display = screen.getPrimaryDisplay()

  logLine(
    `Requested strategy: ${requestedStrategy}; display: ${display.bounds.width}x${display.bounds.height} DIP at ${display.scaleFactor}x; show for ${seconds}s`
  )

  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: color,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false
    }
  })
  spikeWindow = win
  win.setMenu(null)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (details) => details.preventDefault())

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${color};}
    body{display:grid;place-items:center;font-family:Segoe UI,sans-serif;color:#fff;}
    .label{padding:18px 22px;border-radius:12px;background:rgba(0,0,0,.55);font-size:18px;}
    small{display:block;margin-top:6px;font-size:13px;opacity:.8;}
  </style></head><body><div class="label">HomeLayer Phase 6B spike<small>Check the desktop, then wait for the timer.</small></div></body></html>`
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  logLine(`Window loaded: ${win.id}`)

  await delay(300)
  const hwnd = nativeWindowHandle(win)
  logLine(`Native window handle: 0x${hwnd.toString(16)}`)
  const physicalRect = screen.dipToScreenRect(win, display.bounds)
  logLine(
    `Physical target: ${physicalRect.width}x${physicalRect.height} at ${physicalRect.x},${physicalRect.y}`
  )

  const attach = await attachToDesktop(hwnd, physicalRect, requestedStrategy)
  const ignoreMouse = process.env.HL_WP_IGNORE_MOUSE === '1'
  logLine(`Ignore mouse: ${ignoreMouse}`)
  if (ignoreMouse) {
    win.setIgnoreMouseEvents(true)
  }
  win.showInactive()
  await delay(500)

  const diagnostics = collectDiagnostics(hwnd, attach)
  const result: SpikeResult = {
    timestamp: new Date().toISOString(),
    windowsBuild: release(),
    systemVersion: process.getSystemVersion(),
    architecture: process.arch,
    electron: process.versions.electron,
    requestedStrategy,
    usedStrategy: attach.strategy,
    color,
    displays: displayInfo(),
    attach,
    diagnostics,
    manualChecks: [
      'The coloured layer is visible between the desktop icons and the wallpaper.',
      'Desktop icons are visible and clickable; right-clicking the desktop works.',
      'The taskbar is unaffected.',
      'The spike window is absent from Alt+Tab.',
      'Win+D leaves the coloured layer behind the icons.'
    ],
    error: null
  }
  writeResult(result)

  logLine(`Used strategy: ${attach.strategy}`)
  logLine(`Parent: ${attach.parentClass} 0x${attach.parent.toString(16)}`)
  logLine(`Layer messages: ${attach.layerMessages.join('; ')}`)
  logLine(`Diagnostics: ${JSON.stringify(diagnostics)}`)
  logLine('Manual checks:')
  for (const check of result.manualChecks) {
    logLine(`- ${check}`)
  }
  logLine('Press Ctrl+Alt+Shift+Q to stop early.')
  globalShortcut.register('Control+Alt+Shift+Q', () => finish(0))
  setTimeout(() => finish(0), seconds * 1000)
}

app
  .whenReady()
  .then(run)
  .catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
    try {
      mkdirSync(OUT_DIR, { recursive: true })
      appendFileSync(LOG_PATH, `ERROR ${message}\n`)
    } catch {
      console.error(message)
    }
    console.error(message)
    writeResult({
      timestamp: new Date().toISOString(),
      windowsBuild: release(),
      systemVersion: process.getSystemVersion(),
      architecture: process.arch,
      electron: process.versions.electron,
      requestedStrategy: resolveStrategy(),
      usedStrategy: null,
      color: resolveColor(),
      displays: [],
      attach: null,
      diagnostics: {},
      manualChecks: [],
      error: message
    })
    setTimeout(() => finish(1), 1000)
  })

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (latestResult) {
    writeResult(latestResult)
  }
})
