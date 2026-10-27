import koffi, { type TypeObject } from 'koffi'
import log from '../services/logger'

const EVENT_SYSTEM_FOREGROUND = 0x0003
// EVENT_SYSTEM_MINIMIZEEND fires when Win+D "show desktop" finishes animating
// and the desktop is fully visible/interactive.
const EVENT_SYSTEM_MINIMIZEEND = 0x0017
const WINEVENT_OUTOFCONTEXT = 0x0000
const WINEVENT_SKIPOWNPROCESS = 0x0002

type Handle = bigint
type SetWinEventHookFunction = (
  eventMin: number,
  eventMax: number,
  module: Handle,
  callback: bigint,
  processId: number,
  threadId: number,
  flags: number
) => number | bigint | null
type UnhookWinEventFunction = (hook: Handle) => number

let user32: ReturnType<typeof koffi.load> | null = null
let setWinEventHook: SetWinEventHookFunction | null = null
let unhookWinEvent: UnhookWinEventFunction | null = null
let winEventProc: TypeObject | null = null

function ensureNativeApi(): void {
  if (setWinEventHook && unhookWinEvent) {
    return
  }

  user32 = koffi.load('user32.dll')
  winEventProc = koffi.proto(
    'void __stdcall WinEventProc(uintptr_t hHook, uint32_t event, uintptr_t hwnd, int32_t idObject, int32_t idChild, uint32_t idEventThread, uint32_t msEventTime)'
  )
  setWinEventHook = user32.func('SetWinEventHook', 'uintptr_t', [
    'uint32_t',
    'uint32_t',
    'uintptr_t',
    koffi.pointer(winEventProc),
    'uint32_t',
    'uint32_t',
    'uint32_t'
  ]) as SetWinEventHookFunction
  unhookWinEvent = user32.func(
    'int __stdcall UnhookWinEvent(uintptr_t hWinEventHook)'
  ) as UnhookWinEventFunction
}

export function watchForeground(onForeground: () => void): (() => void) | null {
  if (process.platform !== 'win32') {
    return null
  }

  try {
    ensureNativeApi()
    if (!setWinEventHook || !unhookWinEvent || !winEventProc) {
      return null
    }

    const callback = koffi.register((_hook: bigint, event: number): void => {
      log.debug('Desktop event received', { event: `0x${event.toString(16)}` })
      onForeground()
    }, koffi.pointer(winEventProc))

    // A single range hook covers both:
    //   - EVENT_SYSTEM_FOREGROUND (0x0003): ordinary app focus changes
    //   - EVENT_SYSTEM_MINIMIZEEND (0x0017): Win+D "show desktop" animation done
    // Using one range hook is cheaper than two separate SetWinEventHook calls.
    // The burst-repin logic in layout.ts debounces the extra events.
    const hook = setWinEventHook(
      EVENT_SYSTEM_FOREGROUND,
      EVENT_SYSTEM_MINIMIZEEND,
      0n,
      callback,
      0,
      0,
      WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS
    )

    if (!hook) {
      koffi.unregister(callback)
      log.warn('Foreground watcher could not be installed')
      return null
    }

    const handle = BigInt(hook)
    log.info('Foreground watcher active; widgets repin on foreground change and show-desktop')

    return () => {
      try {
        unhookWinEvent?.(handle)
      } finally {
        koffi.unregister(callback)
      }
    }
  } catch (error) {
    log.warn('Foreground watcher could not be installed', error)
    return null
  }
}
