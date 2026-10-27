import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextSlideshowId, WallpaperSlideshow } from '../../src/main/services/wallpaper-slideshow'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('wallpaper slideshow scheduling', () => {
  it('uses a chained timeout for each interval', async () => {
    const onChange = vi.fn()
    const slideshow = new WallpaperSlideshow({ intervalMinutes: 1, onChange })

    slideshow.start(Date.now())
    expect(vi.getTimerCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(59_999)
    expect(onChange).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onChange).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(onChange).toHaveBeenCalledTimes(2)

    slideshow.stop()
  })

  it('recomputes and changes immediately after a long sleep', async () => {
    const onChange = vi.fn()
    const slideshow = new WallpaperSlideshow({ intervalMinutes: 1, onChange })

    slideshow.start(Date.now())
    vi.setSystemTime(new Date(Date.now() + 10 * 60_000))
    slideshow.recompute()

    await vi.advanceTimersByTimeAsync(0)
    expect(onChange).toHaveBeenCalledTimes(1)

    slideshow.stop()
  })

  it('supports the daily interval', async () => {
    const onChange = vi.fn()
    const slideshow = new WallpaperSlideshow({ intervalMinutes: 1440, onChange })

    slideshow.start(Date.now())
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000 - 1)
    expect(onChange).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onChange).toHaveBeenCalledTimes(1)

    slideshow.stop()
  })

  it('stops the timer cleanly', async () => {
    const onChange = vi.fn()
    const slideshow = new WallpaperSlideshow({ intervalMinutes: 1, onChange })

    slideshow.start(Date.now())
    slideshow.stop()
    await vi.advanceTimersByTimeAsync(5 * 60_000)

    expect(onChange).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses the configured last change time', async () => {
    const onChange = vi.fn()
    const slideshow = new WallpaperSlideshow({ intervalMinutes: 5, onChange })

    slideshow.start(Date.now() - 4 * 60_000)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(onChange).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onChange).toHaveBeenCalledTimes(1)

    slideshow.stop()
  })
})

describe('slideshow order', () => {
  it('advances in order and wraps', () => {
    expect(nextSlideshowId(['a', 'b', 'c'], 'a', false)).toBe('b')
    expect(nextSlideshowId(['a', 'b', 'c'], 'c', false)).toBe('a')
    expect(nextSlideshowId(['a'], 'a', false)).toBe('a')
    expect(nextSlideshowId([], null, false)).toBeNull()
  })

  it('shuffle never picks the current wallpaper', () => {
    expect(nextSlideshowId(['a', 'b', 'c'], 'b', true, () => 0)).toBe('a')
    expect(nextSlideshowId(['a', 'b', 'c'], 'b', true, () => 0.99)).toBe('c')
    expect(nextSlideshowId(['a', 'b'], 'a', true, () => 0)).toBe('b')
  })
})
