import { describe, expect, it } from 'vitest'
import {
  decideWallpaperPause,
  normalizeCursorPoint,
  shouldPauseForNotificationState
} from '../../src/main/services/wallpaper-live-policy'

describe('live wallpaper pause policy', () => {
  const base = {
    notificationState: null,
    foregroundFullscreen: false,
    onBattery: false,
    pauseOnBattery: true,
    locked: false,
    suspended: false,
    userPaused: false
  }

  it('pauses for Windows presentation and fullscreen notification states', () => {
    expect(shouldPauseForNotificationState(2)).toBe(true)
    expect(shouldPauseForNotificationState(3)).toBe(true)
    expect(shouldPauseForNotificationState(4)).toBe(true)
    expect(shouldPauseForNotificationState(1)).toBe(false)
    expect(shouldPauseForNotificationState(null)).toBe(false)
  })

  it('pauses for a fullscreen foreground window', () => {
    expect(decideWallpaperPause({ ...base, foregroundFullscreen: true })).toEqual({
      paused: true,
      reasons: ['fullscreen']
    })
  })

  it('honors the battery pause setting', () => {
    expect(decideWallpaperPause({ ...base, onBattery: true })).toEqual({
      paused: true,
      reasons: ['battery']
    })
    expect(decideWallpaperPause({ ...base, onBattery: true, pauseOnBattery: false })).toEqual({
      paused: false,
      reasons: []
    })
  })

  it('combines lock, suspend, and user pause reasons', () => {
    expect(
      decideWallpaperPause({
        ...base,
        notificationState: 3,
        locked: true,
        suspended: true,
        userPaused: true
      })
    ).toEqual({
      paused: true,
      reasons: ['notification', 'locked', 'suspended', 'user']
    })
  })
})

describe('normalizeCursorPoint', () => {
  it('maps display coordinates to a 0..1 range', () => {
    expect(
      normalizeCursorPoint({ x: 200, y: 150 }, { x: 100, y: 50, width: 400, height: 200 })
    ).toEqual({ x: 0.25, y: 0.5 })
  })

  it('clamps points outside the display', () => {
    expect(
      normalizeCursorPoint({ x: -20, y: 999 }, { x: 0, y: 0, width: 100, height: 100 })
    ).toEqual({ x: 0, y: 1 })
  })
})
