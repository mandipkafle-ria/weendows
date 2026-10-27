import { describe, expect, it } from 'vitest'
import { parseWallpaperStrategy, strategyCandidates } from '../../src/main/native/wallpaper-attach'

describe('wallpaper attach strategy selection', () => {
  it('parses supported strategies and defaults to auto', () => {
    expect(parseWallpaperStrategy(undefined)).toBe('auto')
    expect(parseWallpaperStrategy('auto')).toBe('auto')
    expect(parseWallpaperStrategy('classic')).toBe('classic')
    expect(parseWallpaperStrategy('PROGMAN-CHILD')).toBe('progman-child')
    expect(parseWallpaperStrategy('other')).toBe('auto')
  })

  it('uses the detected layout first for auto', () => {
    expect(strategyCandidates('progman-child', 'auto')).toEqual(['progman-child', 'classic'])
    expect(strategyCandidates('classic', 'auto')).toEqual(['classic', 'progman-child'])
  })

  it('tries an explicit strategy before the alternate', () => {
    expect(strategyCandidates('progman-child', 'classic')).toEqual(['classic', 'progman-child'])
    expect(strategyCandidates('classic', 'progman-child')).toEqual(['progman-child', 'classic'])
  })
})
