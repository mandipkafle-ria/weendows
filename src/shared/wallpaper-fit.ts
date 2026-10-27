import { WALLPAPER_FITS, WALLPAPER_INTERVAL_MINUTES, type WallpaperFit } from './types'

export interface WallpaperFitValues {
  style: string
  tile: string
}

export const WALLPAPER_FIT_TABLE: Record<WallpaperFit, WallpaperFitValues> = {
  fill: { style: '10', tile: '0' },
  fit: { style: '6', tile: '0' },
  stretch: { style: '2', tile: '0' },
  tile: { style: '0', tile: '1' },
  center: { style: '0', tile: '0' },
  span: { style: '22', tile: '0' }
}

export const WALLPAPER_LIVE_FITS = ['fill', 'fit', 'stretch', 'center'] as const

export const WALLPAPER_FIT_LABELS: Record<WallpaperFit, string> = {
  fill: 'Fill',
  fit: 'Fit',
  stretch: 'Stretch',
  tile: 'Tile',
  center: 'Center',
  span: 'Span'
}

export function isWallpaperFit(value: unknown): value is WallpaperFit {
  return typeof value === 'string' && (WALLPAPER_FITS as readonly string[]).includes(value)
}

export function isLiveWallpaperFit(value: unknown): value is WallpaperFit {
  return typeof value === 'string' && (WALLPAPER_LIVE_FITS as readonly string[]).includes(value)
}

export function isWallpaperInterval(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (WALLPAPER_INTERVAL_MINUTES as readonly number[]).includes(value)
  )
}
