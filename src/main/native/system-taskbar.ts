import koffi from 'koffi'
import log from '../services/logger'

type Handle = bigint
type FindWindowFunction = (className: string, windowName: string | null) => number | bigint | null
type FindWindowExFunction = (
  parent: Handle,
  childAfter: Handle,
  className: string | null,
  windowName: string | null
) => number | bigint | null
type ShowWindowFunction = (hwnd: Handle, command: number) => number
type IsWindowVisibleFunction = (hwnd: Handle) => number
type IsWindowFunction = (hwnd: Handle) => number

const SW_HIDE = 0
const SW_SHOW = 5
const TASKBAR_CLASS = 'Shell_TrayWnd'
const SECONDARY_TASKBAR_CLASS = 'Shell_SecondaryTrayWnd'
const RECHECK_MS = 2000
const MAX_SECONDARY_TASKBARS = 16

let user32: ReturnType<typeof koffi.load> | null = null
let findWindowW: FindWindowFunction | null = null
let findWindowExW: FindWindowExFunction | null = null
let showWindowW: ShowWindowFunction | null = null
let isWindowVisibleW: IsWindowVisibleFunction | null = null
let isWindowW: IsWindowFunction | null = null

const hiddenHandles = new Map<Handle, true>()
let recheckTimer: NodeJS.Timeout | null = null
let hideRequested = false

function ensureNativeApi(): void {
  if (user32 && findWindowW && findWindowExW && showWindowW && isWindowVisibleW && isWindowW) {
    return
  }
  user32 = koffi.load('user32.dll')
  findWindowW = user32.func(
    'uintptr_t __stdcall FindWindowW(str16 className, str16 windowName)'
  ) as FindWindowFunction
  findWindowExW = user32.func(
    'uintptr_t __stdcall FindWindowExW(uintptr_t parent, uintptr_t childAfter, str16 className, str16 windowName)'
  ) as FindWindowExFunction
  showWindowW = user32.func(
    'int __stdcall ShowWindow(uintptr_t hwnd, int command)'
  ) as ShowWindowFunction
  isWindowVisibleW = user32.func(
    'int __stdcall IsWindowVisible(uintptr_t hwnd)'
  ) as IsWindowVisibleFunction
  isWindowW = user32.func('int __stdcall IsWindow(uintptr_t hwnd)') as IsWindowFunction
}

function normalizeHandle(value: number | bigint | null | undefined): Handle | null {
  if (value === null || value === undefined) {
    return null
  }
  const handle = BigInt(value)
  return handle === 0n ? null : handle
}

function findTaskbarHandles(): Handle[] {
  ensureNativeApi()
  const handles: Handle[] = []
  const primary = normalizeHandle(findWindowW?.(TASKBAR_CLASS, null))
  if (primary) {
    handles.push(primary)
  }

  let after = 0n
  for (let index = 0; index < MAX_SECONDARY_TASKBARS; index += 1) {
    const secondary = normalizeHandle(findWindowExW?.(0n, after, SECONDARY_TASKBAR_CLASS, null))
    if (!secondary) {
      break
    }
    handles.push(secondary)
    after = secondary
  }
  return handles
}

function hideTaskbars(): number {
  let hidden = 0
  for (const handle of findTaskbarHandles()) {
    if (!isWindowW?.(handle)) {
      hiddenHandles.delete(handle)
      continue
    }
    if (hiddenHandles.has(handle)) {
      hidden += 1
      continue
    }
    if (!isWindowVisibleW?.(handle)) {
      continue
    }
    showWindowW?.(handle, SW_HIDE)
    hiddenHandles.set(handle, true)
    hidden += 1
  }
  return hidden
}

function restoreTaskbars(): void {
  for (const handle of hiddenHandles.keys()) {
    if (isWindowW?.(handle)) {
      showWindowW?.(handle, SW_SHOW)
    }
  }
  hiddenHandles.clear()
}

function stopRecheck(): void {
  if (recheckTimer) {
    clearInterval(recheckTimer)
    recheckTimer = null
  }
}

function startRecheck(): void {
  if (recheckTimer) {
    return
  }
  recheckTimer = setInterval(() => {
    if (!hideRequested) {
      stopRecheck()
      return
    }
    try {
      hideTaskbars()
    } catch (error) {
      log.warn('Could not re-hide the Windows taskbar', error)
    }
  }, RECHECK_MS)
  recheckTimer.unref()
}

export interface SystemTaskbarResult {
  hidden: boolean
  count: number
  error: string | null
}

export function setSystemTaskbarHidden(hidden: boolean): SystemTaskbarResult {
  try {
    if (!hidden) {
      hideRequested = false
      stopRecheck()
      restoreTaskbars()
      return { hidden: false, count: 0, error: null }
    }

    hideRequested = true
    const count = hideTaskbars()
    startRecheck()
    return { hidden: count > 0, count, error: null }
  } catch (error) {
    hideRequested = false
    stopRecheck()
    return {
      hidden: false,
      count: 0,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function isSystemTaskbarHidden(): boolean {
  return hiddenHandles.size > 0
}

process.once('exit', () => {
  try {
    setSystemTaskbarHidden(false)
  } catch {
    // The process is exiting; there is nothing useful left to do.
  }
})
