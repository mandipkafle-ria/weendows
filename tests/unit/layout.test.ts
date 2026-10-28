import { describe, expect, it } from 'vitest'
import { DEFAULT_WIDGET_APPEARANCE } from '../../src/shared/appearance'
import type { WidgetPlacement } from '../../src/shared/types'
import {
  boundsForPlacement,
  centerBounds,
  clampPlacement,
  clampRect,
  displayForPlacement,
  magnetize,
  placementFromBounds,
  snapRect,
  snapValue,
  type DisplayLike,
  type Rect
} from '../../src/main/windows/layout-math'

const primary: DisplayLike = {
  id: 'primary',
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
  workArea: { x: 1920, y: 0, width: 1920, height: 1040 }
}

function placement(overrides: Partial<WidgetPlacement> = {}): WidgetPlacement {
  return {
    widgetId: 'clock-1',
    displayId: primary.id,
    x: 100,
    y: 50,
    width: 240,
    height: 140,
    zOrder: 1,
    locked: false,
    enabled: true,
    opacity: 1,
    ...DEFAULT_WIDGET_APPEARANCE,
    ...overrides
  }
}

describe('snapping', () => {
  it('rounds values to the nearest grid step', () => {
    expect(snapValue(11, 8)).toBe(8)
    expect(snapValue(13, 8)).toBe(16)
    expect(snapValue(-13, 8)).toBe(-16)
  })

  it('snaps every edge of a rectangle without changing its shape', () => {
    expect(snapRect({ x: 11, y: 13, width: 237, height: 141 }, 8)).toEqual({
      x: 8,
      y: 16,
      width: 240,
      height: 144
    })
  })
})

describe('clamping', () => {
  it('leaves a fully visible rectangle unchanged', () => {
    const rect: Rect = { x: 2000, y: 100, width: 240, height: 140 }
    expect(clampRect(rect, primary.workArea, 48)).toEqual(rect)
  })

  it('keeps at least 48 DIP visible on each axis', () => {
    const rect: Rect = { x: 5000, y: -500, width: 240, height: 140 }
    const clamped = clampRect(rect, primary.workArea, 48)

    expect(clamped.x).toBe(1920 + 1920 - 48)
    expect(clamped.y).toBe(-140 + 48)
  })

  it('keeps small widgets fully visible', () => {
    const clamped = clampRect(
      { x: -100, y: -100, width: 20, height: 20 },
      { x: 0, y: 0, width: 100, height: 100 },
      48
    )
    expect(clamped).toEqual({ x: 0, y: 0, width: 20, height: 20 })
  })

  it('converts and clamps a placement against display bounds', () => {
    const clamped = clampPlacement(
      placement({ x: 5000, y: -500, displayId: primary.id }),
      primary,
      48
    )

    expect(clamped.displayId).toBe(primary.id)
    expect(clamped.x).toBe(1872)
    expect(clamped.y).toBe(-92)
  })
})

describe('magnetism', () => {
  it('aligns close edges', () => {
    const rect: Rect = { x: 101, y: 101, width: 100, height: 100 }
    const other: Rect = { x: 100, y: 100, width: 100, height: 100 }

    expect(magnetize(rect, [other], 8)).toEqual({ x: 100, y: 100 })
  })

  it('aligns opposite edges within the threshold', () => {
    const rect: Rect = { x: 303, y: 103, width: 100, height: 100 }
    const other: Rect = { x: 200, y: 200, width: 100, height: 100 }

    expect(magnetize(rect, [other], 8)).toEqual({ x: 300, y: 100 })
  })

  it('does nothing outside the threshold', () => {
    const rect: Rect = { x: 150, y: 150, width: 100, height: 100 }
    const other: Rect = { x: 100, y: 100, width: 100, height: 100 }

    expect(magnetize(rect, [other], 8)).toEqual({ x: 150, y: 150 })
  })
})

describe('placement conversion', () => {
  it('maps placement coordinates through display bounds', () => {
    expect(boundsForPlacement(placement(), primary)).toEqual({
      x: 2020,
      y: 50,
      width: 240,
      height: 140
    })
  })

  it('stores global bounds relative to the display', () => {
    const result = placementFromBounds(
      placement(),
      { x: 2000, y: 40, width: 240, height: 140 },
      primary
    )

    expect(result.x).toBe(80)
    expect(result.y).toBe(40)
    expect(result.displayId).toBe(primary.id)
  })

  it('falls back to the primary display when the saved display is gone', () => {
    const secondary: DisplayLike = {
      id: 'secondary',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 }
    }

    expect(displayForPlacement(placement({ displayId: 'secondary' }), [primary], primary).id).toBe(
      'primary'
    )
    expect(
      displayForPlacement(placement({ displayId: 'secondary' }), [primary, secondary], primary).id
    ).toBe('secondary')
  })
})

describe('gallery placement', () => {
  it('centres a new widget and applies the cascade offset', () => {
    expect(
      centerBounds({ x: 0, y: 0, width: 1000, height: 800 }, { width: 240, height: 140 }, 1, 24)
    ).toEqual({ x: 404, y: 354, width: 240, height: 140 })
  })
})
