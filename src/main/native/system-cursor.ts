import { existsSync } from 'node:fs'
import { join } from 'node:path'
import koffi, { type LibraryHandle } from 'koffi'
import type { CursorStyle } from '../../shared/types'
import log from '../services/logger'

const OCR_NORMAL = 32512
const SPI_SETCURSORS = 0x0057
const SPIF_SENDCHANGE = 0x0002

type Handle = number | bigint | null
type LoadCursorFromFileFunction = (file: string) => Handle
type SetSystemCursorFunction = (cursor: bigint, id: number) => number
type DestroyCursorFunction = (cursor: bigint) => number
type SystemParametersInfoFunction = (
  action: number,
  param: number,
  value: number,
  winIni: number
) => number

export interface SystemCursorBackend {
  replace(file: string): void
  restore(): void
}

export interface SystemCursorServiceOptions {
  cursorDir: string
  backend?: SystemCursorBackend | null
}

function createWindowsBackend(): SystemCursorBackend | null {
  if (process.platform !== 'win32') {
    return null
  }

  try {
    const user32: LibraryHandle = koffi.load('user32.dll')
    const loadCursorFromFile = user32.func(
      'uintptr_t __stdcall LoadCursorFromFileW(str16 file)'
    ) as LoadCursorFromFileFunction
    const setSystemCursor = user32.func(
      'int __stdcall SetSystemCursor(uintptr_t cursor, uint32_t id)'
    ) as SetSystemCursorFunction
    const destroyCursor = user32.func(
      'int __stdcall DestroyCursor(uintptr_t cursor)'
    ) as DestroyCursorFunction
    const systemParametersInfo = user32.func(
      'int __stdcall SystemParametersInfoW(uint32_t action, uint32_t param, uintptr_t value, uint32_t winIni)'
    ) as SystemParametersInfoFunction

    return {
      replace(file: string): void {
        const loaded = loadCursorFromFile(file)
        if (loaded === null) {
          throw new Error('Windows could not load the cursor file.')
        }
        const cursor = BigInt(loaded)
        if (cursor === 0n) {
          throw new Error('Windows could not load the cursor file.')
        }
        if (!setSystemCursor(cursor, OCR_NORMAL)) {
          destroyCursor(cursor)
          throw new Error('Windows could not apply the cursor.')
        }
      },
      restore(): void {
        if (!systemParametersInfo(SPI_SETCURSORS, 0, 0, SPIF_SENDCHANGE)) {
          throw new Error('Windows could not restore the cursor scheme.')
        }
      }
    }
  } catch (error) {
    log.warn('System-wide cursor support could not be initialized', error)
    return null
  }
}

export class SystemCursorService {
  private readonly cursorDir: string
  private readonly backend: SystemCursorBackend | null
  private applied: CursorStyle | null = null

  constructor(options: SystemCursorServiceOptions) {
    this.cursorDir = options.cursorDir
    this.backend = options.backend === undefined ? createWindowsBackend() : options.backend
  }

  apply(style: CursorStyle): void {
    if (style === 'system') {
      this.restore()
      return
    }
    if (this.applied === style) {
      return
    }
    if (!this.backend) {
      throw new Error('System-wide cursor packs are unavailable.')
    }

    const file = join(this.cursorDir, `${style}.cur`)
    if (!existsSync(file)) {
      throw new Error(`The ${style} cursor file is missing.`)
    }
    this.backend.replace(file)
    this.applied = style
    log.info('System-wide cursor applied', { style })
  }

  restore(): void {
    if (!this.applied || !this.backend) {
      return
    }
    this.backend.restore()
    this.applied = null
    log.info('System-wide cursor restored')
  }

  sync(style: CursorStyle, enabled: boolean): void {
    if (!enabled) {
      this.restore()
      return
    }
    this.apply(style)
  }
}
