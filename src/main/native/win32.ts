import koffi, { type LibraryHandle } from 'koffi'

type TickCountFunction = () => number | bigint
type FindWindowFunction = (className: string, title: string | null) => number | bigint | null

let user32: LibraryHandle | null = null
let kernel32: LibraryHandle | null = null
let getTickCount64: TickCountFunction | null = null
let findWindowW: FindWindowFunction | null = null

function ensureNativeApi(): void {
  if (getTickCount64 && findWindowW) {
    return
  }

  user32 = koffi.load('user32.dll')
  kernel32 = koffi.load('kernel32.dll')

  getTickCount64 = kernel32.func('uint64_t __stdcall GetTickCount64()') as TickCountFunction
  findWindowW = user32.func(
    'uintptr_t __stdcall FindWindowW(str16 cls, str16 title)'
  ) as FindWindowFunction
}

export function tickCount(): number {
  ensureNativeApi()
  return Number(getTickCount64?.())
}

export function findWindow(className: string): bigint | null {
  ensureNativeApi()
  const handle = findWindowW?.(className, null)
  if (handle === null || handle === undefined) {
    return null
  }
  const value = BigInt(handle)
  return value === 0n ? null : value
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
