import koffi, { type LibraryHandle } from 'koffi'

type TickCountFunction = () => number | bigint
type FindWindowFunction = (className: string, title: string | null) => number | bigint | null
type FindWindowExFunction = (
  parent: bigint,
  childAfter: bigint,
  className: string,
  title: string | null
) => number | bigint | null
type GetWindowFunction = (hwnd: bigint, command: number) => number | bigint | null
type SetWindowPosFunction = (
  hwnd: bigint,
  insertAfter: bigint,
  x: number,
  y: number,
  cx: number,
  cy: number,
  flags: number
) => number
type SetParentFunction = (child: bigint, parent: bigint) => number | bigint | null
type GetParentFunction = (hwnd: bigint) => number | bigint | null
type IsWindowFunction = (hwnd: bigint) => number
type GetAsyncKeyStateFunction = (key: number) => number

let user32: LibraryHandle | null = null
let kernel32: LibraryHandle | null = null
let getTickCount64: TickCountFunction | null = null
let findWindowW: FindWindowFunction | null = null
let findWindowExW: FindWindowExFunction | null = null
let getWindowRaw: GetWindowFunction | null = null
let setWindowPosRaw: SetWindowPosFunction | null = null
let setParentRaw: SetParentFunction | null = null
let getParentRaw: GetParentFunction | null = null
let isWindowRaw: IsWindowFunction | null = null
let getAsyncKeyStateRaw: GetAsyncKeyStateFunction | null = null

export const VK_MENU = 0x12
export const HWND_TOP = 0n
export const HWND_BOTTOM = 1n
export const GW_HWNDPREV = 3
export const SWP_NOSIZE = 0x0001
export const SWP_NOMOVE = 0x0002
export const SWP_NOACTIVATE = 0x0010
export const SWP_PIN = SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE

function ensureNativeApi(): void {
  if (
    getTickCount64 &&
    findWindowW &&
    findWindowExW &&
    getWindowRaw &&
    setWindowPosRaw &&
    setParentRaw &&
    getParentRaw &&
    isWindowRaw &&
    getAsyncKeyStateRaw
  ) {
    return
  }

  user32 = koffi.load('user32.dll')
  kernel32 = koffi.load('kernel32.dll')

  getTickCount64 = kernel32.func('uint64_t __stdcall GetTickCount64()') as TickCountFunction
  findWindowW = user32.func(
    'uintptr_t __stdcall FindWindowW(str16 cls, str16 title)'
  ) as FindWindowFunction
  findWindowExW = user32.func(
    'uintptr_t __stdcall FindWindowExW(uintptr_t parent, uintptr_t childAfter, str16 cls, str16 title)'
  ) as FindWindowExFunction
  getWindowRaw = user32.func(
    'uintptr_t __stdcall GetWindow(uintptr_t hwnd, uint32_t command)'
  ) as GetWindowFunction
  setWindowPosRaw = user32.func(
    'int __stdcall SetWindowPos(uintptr_t hwnd, uintptr_t insertAfter, int x, int y, int cx, int cy, uint32_t flags)'
  ) as SetWindowPosFunction
  setParentRaw = user32.func(
    'uintptr_t __stdcall SetParent(uintptr_t child, uintptr_t parent)'
  ) as SetParentFunction
  getParentRaw = user32.func('uintptr_t __stdcall GetParent(uintptr_t hwnd)') as GetParentFunction
  isWindowRaw = user32.func('int __stdcall IsWindow(uintptr_t hwnd)') as IsWindowFunction
  getAsyncKeyStateRaw = user32.func(
    'int16_t __stdcall GetAsyncKeyState(int key)'
  ) as GetAsyncKeyStateFunction
}

function normalizeHandle(value: number | bigint | null | undefined): bigint | null {
  if (value === null || value === undefined) {
    return null
  }
  const handle = BigInt(value)
  return handle === 0n ? null : handle
}

export function tickCount(): number {
  ensureNativeApi()
  return Number(getTickCount64?.())
}

export function findWindow(className: string): bigint | null {
  ensureNativeApi()
  return normalizeHandle(findWindowW?.(className, null))
}

export function findWindowEx(parent: bigint, childAfter: bigint, className: string): bigint | null {
  ensureNativeApi()
  return normalizeHandle(findWindowExW?.(parent, childAfter, className, null))
}

export function getWindow(hwnd: bigint, command: number): bigint | null {
  ensureNativeApi()
  return normalizeHandle(getWindowRaw?.(hwnd, command))
}

export function setWindowPos(hwnd: bigint, insertAfter: bigint): boolean {
  ensureNativeApi()
  const result = setWindowPosRaw?.(hwnd, insertAfter, 0, 0, 0, 0, SWP_PIN)
  return Boolean(result)
}

export function setParent(child: bigint, parent: bigint): void {
  ensureNativeApi()
  setParentRaw?.(child, parent)
}

export function getParent(hwnd: bigint): bigint | null {
  ensureNativeApi()
  return normalizeHandle(getParentRaw?.(hwnd))
}

export function isWindow(hwnd: bigint): boolean {
  ensureNativeApi()
  return Boolean(isWindowRaw?.(hwnd))
}

export function isAltDown(): boolean {
  try {
    ensureNativeApi()
    const state = getAsyncKeyStateRaw?.(VK_MENU) ?? 0
    return (Number(state) & 0x8000) !== 0
  } catch {
    return false
  }
}

export interface NativeSmokeTest {
  tickCount: number
  progmanHandle: string | null
}

export function runNativeSmokeTest(): NativeSmokeTest {
  const handle = findWindow('Progman')
  return {
    tickCount: tickCount(),
    progmanHandle: handle === null ? null : `0x${handle.toString(16)}`
  }
}
