import { describe, expect, it } from 'vitest'
import {
  isWallpaperFit,
  isWallpaperInterval,
  WALLPAPER_FIT_TABLE
} from '../../src/shared/wallpaper-fit'
import { WALLPAPER_FITS, WALLPAPER_INTERVAL_MINUTES } from '../../src/shared/types'

describe('wallpaper fit table', () => {
  it('matches the Windows WallpaperStyle and TileWallpaper values', () => {
    expect(WALLPAPER_FIT_TABLE).toEqual({
      fill: { style: '10', tile: '0' },
      fit: { style: '6', tile: '0' },
      stretch: { style: '2', tile: '0' },
      tile: { style: '0', tile: '1' },
      center: { style: '0', tile: '0' },
      span: { style: '22', tile: '0' }
    })
    expect(WALLPAPER_FITS).toEqual(['fill', 'fit', 'stretch', 'tile', 'center', 'span'])
  })

  it('recognizes only the supported fits and slideshow intervals', () => {
    expect(isWallpaperFit('span')).toBe(true)
    expect(isWallpaperFit('cover')).toBe(false)
    expect(isWallpaperFit(null)).toBe(false)
    expect(WALLPAPER_INTERVAL_MINUTES).toEqual([1, 5, 15, 30, 60, 1440])
    expect(isWallpaperInterval(1440)).toBe(true)
    expect(isWallpaperInterval(2)).toBe(false)
    expect(isWallpaperInterval('5')).toBe(false)
  })
})
