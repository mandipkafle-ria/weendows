import type { BrowserWindow } from 'electron'
import log from '../services/logger'
import {
  findWindow,
  findWindowEx,
  getParent,
  getWindow,
  GW_HWNDPREV,
  HWND_BOTTOM,
  HWND_TOP,
  isWindow,
  setParent,
  setWindowPos
} from './win32'

export const PIN_STRATEGIES = ['A', 'B', 'C'] as const
export type PinStrategy = (typeof PIN_STRATEGIES)[number]

export const AUTO_PIN_STRATEGY: PinStrategy = 'B'

export interface ResolvedPinStrategy {
  strategy: PinStrategy
  auto: boolean
  requested: string
}

export function resolvePinStrategy(
  raw: string | undefined = process.env.HL_PIN_STRATEGY
): ResolvedPinStrategy {
  const requested = raw?.trim() || 'auto'
  const value = requested.toUpperCase()
  if (value === 'A' || value === 'B' || value === 'C') {
    return { strategy: value, auto: false, requested }
  }
  if (value !== 'AUTO') {
    log.warn('Invalid HL_PIN_STRATEGY; falling back to auto', { value })
  }
  return { strategy: AUTO_PIN_STRATEGY, auto: true, requested }
}

export function logPinStrategy(): ResolvedPinStrategy {
  const resolved = resolvePinStrategy()
  log.info(`Widget pin strategy: ${resolved.strategy} (${resolved.requested})`)
  return resolved
}

function findDesktopHost(): bigint | null {
  const progman = findWindow('Progman')
  if (!progman) {
    return null
  }

  if (findWindowEx(progman, 0n, 'SHELLDLL_DefView')) {
    return progman
  }

  let worker = 0n
  while (true) {
    const next = findWindowEx(0n, worker, 'WorkerW')
    if (!next) {
      break
    }
    if (findWindowEx(next, 0n, 'SHELLDLL_DefView')) {
      return next
    }
    worker = next
  }

  return progman
}

function pinBottom(hwnd: bigint): boolean {
  return setWindowPos(hwnd, HWND_BOTTOM)
}

function pinAboveDesktop(hwnd: bigint): boolean {
  const progman = findWindow('Progman')
  if (!progman) {
    return false
  }

  const above = getWindow(progman, GW_HWNDPREV)
  return setWindowPos(hwnd, above ?? HWND_BOTTOM)
}

function pinAsDesktopChild(hwnd: bigint): boolean {
  const host = findDesktopHost()
  if (!host) {
    return false
  }

  setParent(hwnd, host)
  if (getParent(hwnd) !== host) {
    log.warn('Widget desktop parenting failed', {
      hwnd: `0x${hwnd.toString(16)}`,
      host: `0x${host.toString(16)}`
    })
    return false
  }

  return setWindowPos(hwnd, HWND_TOP)
}

export function pinToDesktop(hwnd: bigint, strategy: PinStrategy): boolean {
  if (!isWindow(hwnd)) {
    return false
  }

  if (strategy === 'A') {
    return pinBottom(hwnd)
  }
  if (strategy === 'B') {
    return pinAboveDesktop(hwnd)
  }
  return pinAsDesktopChild(hwnd)
}

export function pinWithFallback(
  hwnd: bigint,
  strategy: PinStrategy,
  allowFallback: boolean
): boolean {
  const order: PinStrategy[] = allowFallback
    ? [strategy, ...PIN_STRATEGIES.filter((item) => item !== strategy)]
    : [strategy]

  for (const candidate of order) {
    if (pinToDesktop(hwnd, candidate)) {
      if (candidate !== strategy) {
        log.warn('Widget pin strategy fallback used', { requested: strategy, used: candidate })
      }
      return true
    }
    log.warn('Widget pin strategy failed', { strategy: candidate })
  }

  return false
}

export function nativeWindowHandle(win: BrowserWindow): bigint {
  const buffer = win.getNativeWindowHandle()
  return buffer.length === 8 ? buffer.readBigUInt64LE(0) : BigInt(buffer.readUInt32LE(0))
}
