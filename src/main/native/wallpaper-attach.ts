import koffi from 'koffi'
import log from '../services/logger'

export type WallpaperStrategy = 'auto' | 'classic' | 'progman-child'
export type UsedWallpaperStrategy = Exclude<WallpaperStrategy, 'auto'>
export type DesktopLayoutKind = 'progman-child' | 'classic' | 'unknown'

export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
}

export interface NativeRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface DesktopLayout {
  kind: DesktopLayoutKind
  progman: bigint
  defView: bigint | null
  iconHost: bigint | null
  wallpaperHost: bigint | null
}

export interface WallpaperAttachResult {
  strategy: UsedWallpaperStrategy
  parent: bigint
  parentClass: string
  layout: DesktopLayout
  style: { before: number; after: number }
  placement: { parentRect: NativeRect; windowRect: NativeRect | null }
}

type Handle = bigint
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
type GetWindowFunction = (hwnd: Handle, command: number) => number | bigint | null

const GWL_STYLE = -16
const GW_HWNDNEXT = 2
const WS_CHILD = 0x40000000
const WS_POPUP = 0x80000000
const HWND_TOP = 0n
const SWP_NOACTIVATE = 0x0010
const SWP_FRAMECHANGED = 0x0020
const SWP_SHOWWINDOW = 0x0040
const WM_SPAWN_WORKER = 0x052c
const SMTO_NORMAL = 0
const SPAWN_TIMEOUT_MS = 1000
const LAYOUT_SETTLE_MS = 150

let user32: ReturnType<typeof koffi.load> | null = null
let findWindowW: FindWindowFunction | null = null
let findWindowExW: FindWindowExFunction | null = null
let sendMessageTimeoutW: SendMessageTimeoutFunction | null = null
let getWindowLongW: GetWindowLongFunction | null = null
let setWindowLongW: SetWindowLongFunction | null = null
let setParentW: SetParentFunction | null = null
let getParentW: GetParentFunction | null = null
let setWindowPosW: SetWindowPosFunction | null = null
let getWindowRectW: GetWindowRectFunction | null = null
let getClassNameW: GetClassNameFunction | null = null
let isWindowW: IsWindowFunction | null = null
let getWindowW: GetWindowFunction | null = null

const RECT = koffi.struct('WALLPAPER_RECT', {
  left: 'int32_t',
  top: 'int32_t',
  right: 'int32_t',
  bottom: 'int32_t'
})

function ensureNativeApi(): void {
  if (
    user32 &&
    findWindowW &&
    findWindowExW &&
    sendMessageTimeoutW &&
    getWindowLongW &&
    setWindowLongW &&
    setParentW &&
    getParentW &&
    setWindowPosW &&
    getWindowRectW &&
    getClassNameW &&
    isWindowW &&
    getWindowW
  ) {
    return
  }

  user32 = koffi.load('user32.dll')
  findWindowW = user32.func(
    'uintptr_t __stdcall FindWindowW(str16 className, str16 windowName)'
  ) as FindWindowFunction
  findWindowExW = user32.func(
    'uintptr_t __stdcall FindWindowExW(uintptr_t parent, uintptr_t childAfter, str16 className, str16 windowName)'
  ) as FindWindowExFunction
  sendMessageTimeoutW = user32.func(
    'uintptr_t __stdcall SendMessageTimeoutW(uintptr_t hwnd, uint32_t message, uintptr_t wParam, intptr_t lParam, uint32_t flags, uint32_t timeout, _Out_ uintptr_t *result)'
  ) as SendMessageTimeoutFunction
  getWindowLongW = user32.func(
    'int32_t __stdcall GetWindowLongW(uintptr_t hwnd, int index)'
  ) as GetWindowLongFunction
  setWindowLongW = user32.func(
    'int32_t __stdcall SetWindowLongW(uintptr_t hwnd, int index, int32_t value)'
  ) as SetWindowLongFunction
  setParentW = user32.func(
    'uintptr_t __stdcall SetParent(uintptr_t child, uintptr_t parent)'
  ) as SetParentFunction
  getParentW = user32.func('uintptr_t __stdcall GetParent(uintptr_t hwnd)') as GetParentFunction
  setWindowPosW = user32.func(
    'int __stdcall SetWindowPos(uintptr_t hwnd, uintptr_t insertAfter, int x, int y, int cx, int cy, uint32_t flags)'
  ) as SetWindowPosFunction
  getWindowRectW = user32.func('GetWindowRect', 'int', [
    'uintptr_t',
    koffi.out(koffi.pointer(RECT))
  ]) as GetWindowRectFunction
  getClassNameW = user32.func(
    'int __stdcall GetClassNameW(uintptr_t hwnd, _Out_ uint16_t *buffer, int maxCount)'
  ) as GetClassNameFunction
  isWindowW = user32.func('int __stdcall IsWindow(uintptr_t hwnd)') as IsWindowFunction
  getWindowW = user32.func(
    'uintptr_t __stdcall GetWindow(uintptr_t hwnd, uint32_t command)'
  ) as GetWindowFunction
}

function normalizeHandle(value: number | bigint | null | undefined): Handle | null {
  if (value === null || value === undefined) {
    return null
  }
  const handle = BigInt(value)
  return handle === 0n ? null : handle
}

function findWindow(className: string): Handle | null {
  ensureNativeApi()
  return normalizeHandle(findWindowW?.(className, null))
}

function findWindowEx(parent: Handle, after: Handle, className: string | null): Handle | null {
  ensureNativeApi()
  return normalizeHandle(findWindowExW?.(parent, after, className, null))
}

function getWindow(hwnd: Handle, command: number): Handle | null {
  ensureNativeApi()
  return normalizeHandle(getWindowW?.(hwnd, command))
}

function getParent(hwnd: Handle): Handle | null {
  ensureNativeApi()
  return normalizeHandle(getParentW?.(hwnd))
}

function isWindow(hwnd: Handle): boolean {
  ensureNativeApi()
  return Boolean(isWindowW?.(hwnd))
}

function getWindowRect(hwnd: Handle): NativeRect | null {
  ensureNativeApi()
  const rect: NativeRect = { left: 0, top: 0, right: 0, bottom: 0 }
  return getWindowRectW?.(hwnd, rect) ? rect : null
}

function getClassName(hwnd: Handle): string {
  ensureNativeApi()
  const buffer = Buffer.alloc(512)
  const length = getClassNameW?.(hwnd, buffer, 256) ?? 0
  return length > 0 ? buffer.toString('utf16le', 0, length * 2) : ''
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function parseWallpaperStrategy(raw: string | undefined): WallpaperStrategy {
  const value = raw?.trim().toLowerCase()
  if (value === 'classic' || value === 'progman-child' || value === 'auto') {
    return value
  }
  return 'auto'
}

export function resolveWallpaperStrategy(raw: string | undefined = process.env.HL_WP_STRATEGY): {
  requested: WallpaperStrategy
  raw: string
} {
  const requested = parseWallpaperStrategy(raw)
  log.info(`Wallpaper strategy: ${requested} (${raw?.trim() || 'auto'})`)
  return { requested, raw: raw?.trim() || 'auto' }
}

export function strategyCandidates(
  layout: DesktopLayoutKind,
  requested: WallpaperStrategy
): UsedWallpaperStrategy[] {
  const detected: UsedWallpaperStrategy = layout === 'classic' ? 'classic' : 'progman-child'
  const alternate: UsedWallpaperStrategy = detected === 'classic' ? 'progman-child' : 'classic'

  if (requested === 'auto') {
    return [detected, alternate]
  }
  return [requested, requested === 'classic' ? 'progman-child' : 'classic']
}
export function detectDesktopLayout(progman: Handle): DesktopLayout {
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

function sendSpawnWorker(progman: Handle, wParam: Handle, lParam: bigint): boolean {
  ensureNativeApi()
  const output: [bigint] = [0n]
  const result =
    sendMessageTimeoutW?.(
      progman,
      WM_SPAWN_WORKER,
      wParam,
      lParam,
      SMTO_NORMAL,
      SPAWN_TIMEOUT_MS,
      output
    ) ?? 0
  return Number(result) !== 0
}

async function ensureDesktopLayer(progman: Handle): Promise<DesktopLayout> {
  sendSpawnWorker(progman, 0xdn, 0x1n)
  await delay(LAYOUT_SETTLE_MS)
  let layout = detectDesktopLayout(progman)

  if (layout.kind === 'unknown') {
    sendSpawnWorker(progman, 0n, 0n)
    await delay(LAYOUT_SETTLE_MS)
    layout = detectDesktopLayout(progman)
  }

  return layout
}

function makeChildStyle(hwnd: Handle): { before: number; after: number } {
  ensureNativeApi()
  const before = (getWindowLongW?.(hwnd, GWL_STYLE) ?? 0) >>> 0
  const next = (before & ~WS_POPUP) | WS_CHILD
  setWindowLongW?.(hwnd, GWL_STYLE, next | 0)
  const after = (getWindowLongW?.(hwnd, GWL_STYLE) ?? 0) >>> 0

  if ((after & WS_CHILD) === 0 || (after & WS_POPUP) !== 0) {
    throw new Error(
      `Could not switch the wallpaper window to a child style (before=0x${before.toString(16)}, after=0x${after.toString(16)})`
    )
  }

  return { before, after }
}

function placeRelative(
  parent: Handle,
  hwnd: Handle,
  rectPx: PixelRect,
  insertAfter: Handle
): { parentRect: NativeRect; windowRect: NativeRect | null } {
  const parentRect = getWindowRect(parent)
  if (!parentRect) {
    throw new Error('Could not read the desktop parent rectangle')
  }

  const flags = SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW
  const placed = setWindowPosW?.(
    hwnd,
    insertAfter,
    rectPx.x - parentRect.left,
    rectPx.y - parentRect.top,
    rectPx.width,
    rectPx.height,
    flags
  )
  if (!placed) {
    throw new Error('SetWindowPos failed for the wallpaper window')
  }

  return {
    parentRect,
    windowRect: getWindowRect(hwnd)
  }
}

function parentHandleFor(
  layout: DesktopLayout,
  strategy: UsedWallpaperStrategy
): { parent: Handle; insertAfter: Handle } {
  if (strategy === 'classic') {
    if (!layout.wallpaperHost) {
      throw new Error('Classic layout needs a WorkerW host behind the icon WorkerW')
    }
    return { parent: layout.wallpaperHost, insertAfter: HWND_TOP }
  }

  if (!layout.defView) {
    throw new Error('Progman-child layout needs SHELLDLL_DefView under Progman')
  }
  return { parent: layout.progman, insertAfter: layout.defView }
}

export async function attachToDesktop(
  hwnd: Handle,
  rectPx: PixelRect,
  requested: WallpaperStrategy = 'auto'
): Promise<WallpaperAttachResult> {
  if (process.platform !== 'win32') {
    throw new Error('Live wallpapers are only supported on Windows')
  }

  const progman = findWindow('Progman')
  if (!progman) {
    throw new Error('Progman was not found; Explorer may not be running')
  }

  const layout = await ensureDesktopLayer(progman)
  const candidates = strategyCandidates(layout.kind, requested)
  let lastError: Error | null = null

  for (const strategy of candidates) {
    try {
      const { parent, insertAfter } = parentHandleFor(layout, strategy)
      const style = makeChildStyle(hwnd)
      setParentW?.(hwnd, parent)
      if (getParent(hwnd) !== parent) {
        throw new Error(`SetParent did not stick for ${strategy}`)
      }
      const placement = placeRelative(parent, hwnd, rectPx, insertAfter)
      if (!isWindow(parent)) {
        throw new Error('The desktop parent vanished during attach')
      }

      if (requested !== 'auto' && strategy !== requested) {
        log.warn('Wallpaper strategy fallback used', { requested, used: strategy })
      }

      return {
        strategy,
        parent,
        parentClass: getClassName(parent),
        layout,
        style,
        placement
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      log.warn('Wallpaper attach attempt failed', { strategy, error: lastError.message })
    }
  }

  throw lastError ?? new Error('No wallpaper attach strategy was available')
}

export function desktopIsAvailable(): boolean {
  if (process.platform !== 'win32') {
    return false
  }
  return Boolean(findWindow('Progman'))
}

export function desktopParentFor(strategy: UsedWallpaperStrategy): Handle | null {
  if (process.platform !== 'win32') {
    return null
  }
  const progman = findWindow('Progman')
  if (!progman) {
    return null
  }
  const layout = detectDesktopLayout(progman)
  if (strategy === 'progman-child') {
    return layout.kind === 'progman-child' ? layout.progman : null
  }
  return layout.kind === 'classic' ? layout.wallpaperHost : null
}

export function wallpaperWindowIsAttached(hwnd: Handle, parent: Handle): boolean {
  return isWindow(hwnd) && isWindow(parent) && getParent(hwnd) === parent
}

export function nextTopLevelWindow(hwnd: Handle): Handle | null {
  return getWindow(hwnd, GW_HWNDNEXT)
}
