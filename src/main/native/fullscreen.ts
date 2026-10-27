import koffi from 'koffi'

export interface FullscreenSignal {
  notificationState: number | null
  foregroundFullscreen: boolean
}

interface NativeRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface MonitorInfo {
  cbSize: number
  rcMonitor: NativeRect
  rcWork: NativeRect
  dwFlags: number
}

type GetForegroundWindowFunction = () => number | bigint | null
type GetWindowRectFunction = (hwnd: bigint, rect: NativeRect) => number
type GetClassNameFunction = (hwnd: bigint, buffer: Buffer, maxCount: number) => number
type MonitorFromWindowFunction = (hwnd: bigint, flags: number) => number | bigint | null
type GetMonitorInfoFunction = (monitor: bigint, info: MonitorInfo) => number
type QueryUserNotificationStateFunction = (state: [number]) => number

const MONITOR_DEFAULTTONEAREST = 2
const EXCLUDED_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd'])
const RECT = koffi.struct('FULLSCREEN_RECT', {
  left: 'int32_t',
  top: 'int32_t',
  right: 'int32_t',
  bottom: 'int32_t'
})
const MONITORINFO = koffi.struct('FULLSCREEN_MONITORINFO', {
  cbSize: 'uint32_t',
  rcMonitor: RECT,
  rcWork: RECT,
  dwFlags: 'uint32_t'
})

let user32: ReturnType<typeof koffi.load> | null = null
let shell32: ReturnType<typeof koffi.load> | null = null
let getForegroundWindow: GetForegroundWindowFunction | null = null
let getWindowRect: GetWindowRectFunction | null = null
let getClassName: GetClassNameFunction | null = null
let monitorFromWindow: MonitorFromWindowFunction | null = null
let getMonitorInfo: GetMonitorInfoFunction | null = null
let queryUserNotificationState: QueryUserNotificationStateFunction | null = null

function ensureNativeApi(): void {
  if (
    user32 &&
    shell32 &&
    getForegroundWindow &&
    getWindowRect &&
    getClassName &&
    monitorFromWindow &&
    getMonitorInfo &&
    queryUserNotificationState
  ) {
    return
  }

  user32 = koffi.load('user32.dll')
  shell32 = koffi.load('shell32.dll')
  getForegroundWindow = user32.func(
    'uintptr_t __stdcall GetForegroundWindow()'
  ) as GetForegroundWindowFunction
  getWindowRect = user32.func('GetWindowRect', 'int', [
    'uintptr_t',
    koffi.out(koffi.pointer(RECT))
  ]) as GetWindowRectFunction
  getClassName = user32.func(
    'int __stdcall GetClassNameW(uintptr_t hwnd, _Out_ uint16_t *buffer, int maxCount)'
  ) as GetClassNameFunction
  monitorFromWindow = user32.func(
    'uintptr_t __stdcall MonitorFromWindow(uintptr_t hwnd, uint32_t flags)'
  ) as MonitorFromWindowFunction
  getMonitorInfo = user32.func(
    'int __stdcall GetMonitorInfoW(uintptr_t monitor, _Out_ FULLSCREEN_MONITORINFO *info)'
  ) as GetMonitorInfoFunction
  queryUserNotificationState = shell32.func(
    'int32_t __stdcall SHQueryUserNotificationState(_Out_ int32_t *state)'
  ) as QueryUserNotificationStateFunction
}

function normalizeHandle(value: number | bigint | null | undefined): bigint | null {
  if (value === null || value === undefined) {
    return null
  }
  const handle = BigInt(value)
  return handle === 0n ? null : handle
}

function classNameOf(hwnd: bigint): string {
  const buffer = Buffer.alloc(512)
  const length = getClassName?.(hwnd, buffer, 256) ?? 0
  return length > 0 ? buffer.toString('utf16le', 0, length * 2) : ''
}

function queryNotificationState(): number | null {
  ensureNativeApi()
  const output: [number] = [0]
  const result = queryUserNotificationState?.(output) ?? -1
  return result === 0 ? (output[0] ?? null) : null
}

function foregroundCoversMonitor(): boolean {
  ensureNativeApi()
  const hwnd = normalizeHandle(getForegroundWindow?.())
  if (!hwnd) {
    return false
  }
  if (EXCLUDED_CLASSES.has(classNameOf(hwnd))) {
    return false
  }

  const rect: NativeRect = { left: 0, top: 0, right: 0, bottom: 0 }
  if (!getWindowRect?.(hwnd, rect)) {
    return false
  }

  const monitor = normalizeHandle(monitorFromWindow?.(hwnd, MONITOR_DEFAULTTONEAREST))
  if (!monitor) {
    return false
  }

  const info: MonitorInfo = {
    cbSize: koffi.sizeof(MONITORINFO),
    rcMonitor: { left: 0, top: 0, right: 0, bottom: 0 },
    rcWork: { left: 0, top: 0, right: 0, bottom: 0 },
    dwFlags: 0
  }
  if (!getMonitorInfo?.(monitor, info)) {
    return false
  }

  const bounds = info.rcMonitor
  return (
    rect.left <= bounds.left + 1 &&
    rect.top <= bounds.top + 1 &&
    rect.right >= bounds.right - 1 &&
    rect.bottom >= bounds.bottom - 1
  )
}

export function getFullscreenSignal(): FullscreenSignal {
  if (process.platform !== 'win32') {
    return { notificationState: null, foregroundFullscreen: false }
  }

  try {
    return {
      notificationState: queryNotificationState(),
      foregroundFullscreen: foregroundCoversMonitor()
    }
  } catch {
    return { notificationState: null, foregroundFullscreen: false }
  }
}
