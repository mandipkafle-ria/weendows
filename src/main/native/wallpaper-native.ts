import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { promisify } from 'node:util'
import koffi, { type LibraryHandle } from 'koffi'
import { WALLPAPER_FIT_TABLE } from '../../shared/wallpaper-fit'
import type { WallpaperFit } from '../../shared/types'
import log from '../services/logger'

const run = promisify(execFile)
const DESKTOP_KEY = 'HKCU\\Control Panel\\Desktop'
const SPI_SETDESKWALLPAPER = 0x0014
const SPIF_UPDATEINIFILE = 0x01
const SPIF_SENDCHANGE = 0x02

type SystemParametersInfoFunction = (
  action: number,
  param: number,
  value: string,
  winIni: number
) => number

let user32: LibraryHandle | null = null
let systemParametersInfoW: SystemParametersInfoFunction | null = null

function ensureNativeApi(): SystemParametersInfoFunction {
  if (!systemParametersInfoW) {
    user32 = koffi.load('user32.dll')
    systemParametersInfoW = user32.func(
      'int __stdcall SystemParametersInfoW(uint32_t action, uint32_t param, str16 value, uint32_t winIni)'
    ) as SystemParametersInfoFunction
  }
  return systemParametersInfoW
}

function expandEnvironmentVariables(value: string): string {
  return value.replace(/%([^%]+)%/g, (match, name: string) => {
    const key = Object.keys(process.env).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase()
    )
    return key ? (process.env[key] ?? match) : match
  })
}

function parseRegistryValue(output: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = output.match(new RegExp(`^\\s*${escaped}\\s+REG_\\w+\\s+(.*)$`, 'im'))
  return match?.[1]?.trim() || null
}

export function parseWallpaperRegistryValue(output: string): string | null {
  const value = parseRegistryValue(output, 'WallPaper')
  return value ? expandEnvironmentVariables(value) : null
}

export function parseWallpaperFitRegistryValues(output: string): {
  style: string | null
  tile: string | null
} {
  return {
    style: parseRegistryValue(output, 'WallpaperStyle'),
    tile: parseRegistryValue(output, 'TileWallpaper')
  }
}

async function requireAbsoluteFile(file: string): Promise<void> {
  if (!isAbsolute(file)) {
    throw new Error('Wallpaper path must be absolute')
  }
  const stats = await stat(file)
  if (!stats.isFile()) {
    throw new Error('Wallpaper path is not a file')
  }
}

function applyPath(file: string): void {
  if (process.platform !== 'win32') {
    throw new Error('Wallpapers are only supported on Windows')
  }
  const result = ensureNativeApi()(
    SPI_SETDESKWALLPAPER,
    0,
    file,
    SPIF_UPDATEINIFILE | SPIF_SENDCHANGE
  )
  if (!result) {
    throw new Error('SystemParametersInfoW failed to set the wallpaper')
  }
}

export async function readCurrentWallpaperPath(): Promise<string | null> {
  if (process.platform !== 'win32') {
    return null
  }
  try {
    const { stdout } = await run('reg', ['query', DESKTOP_KEY, '/v', 'WallPaper'], {
      windowsHide: true
    })
    return parseWallpaperRegistryValue(stdout)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (String(code) !== '1') {
      log.warn('Could not read the current Windows wallpaper', error)
    }
    return null
  }
}

export async function readCurrentWallpaperFit(): Promise<{
  style: string | null
  tile: string | null
} | null> {
  if (process.platform !== 'win32') {
    return null
  }
  try {
    const { stdout } = await run('reg', ['query', DESKTOP_KEY], { windowsHide: true })
    return parseWallpaperFitRegistryValues(stdout)
  } catch (error) {
    log.warn('Could not read the current Windows wallpaper fit', error)
    return null
  }
}

async function writeFitValues(style: string | null, tile: string | null): Promise<void> {
  if (style !== null) {
    await run(
      'reg',
      ['add', DESKTOP_KEY, '/v', 'WallpaperStyle', '/t', 'REG_SZ', '/d', style, '/f'],
      { windowsHide: true }
    )
  }
  if (tile !== null) {
    await run(
      'reg',
      ['add', DESKTOP_KEY, '/v', 'TileWallpaper', '/t', 'REG_SZ', '/d', tile, '/f'],
      { windowsHide: true }
    )
  }
}

export async function setWallpaper(file: string, fit: WallpaperFit): Promise<void> {
  await requireAbsoluteFile(file)
  const values = WALLPAPER_FIT_TABLE[fit]
  await writeFitValues(values.style, values.tile)
  applyPath(file)
}

export async function setWallpaperPath(
  file: string,
  style: string | null = null,
  tile: string | null = null
): Promise<void> {
  await requireAbsoluteFile(file)
  await writeFitValues(style, tile)
  applyPath(file)
}
