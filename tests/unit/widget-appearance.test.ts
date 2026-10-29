import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WIDGET_APPEARANCE,
  appearanceCss,
  hasCustomAppearance,
  resolveWidgetAppearance
} from '../../src/shared/appearance'

describe('widget appearance', () => {
  it('defaults the border to one pixel', () => {
    expect(DEFAULT_WIDGET_APPEARANCE.borderWidth).toBe(1)
    expect(resolveWidgetAppearance({}).borderWidth).toBe(1)
    expect(resolveWidgetAppearance({ borderWidth: 5 }).borderWidth).toBe(5)
  })

  it('draws the border as an inset ring of the requested width', () => {
    const css = appearanceCss({ ...DEFAULT_WIDGET_APPEARANCE, borderWidth: 4 })
    expect(css).toContain('--widget-border-width: 4px')
    expect(css).toContain('inset 0 0 0 4px')
  })

  it('keeps the card shadow inside the rounded silhouette', () => {
    const css = appearanceCss({
      ...DEFAULT_WIDGET_APPEARANCE,
      bgColor: '#101820',
      borderWidth: 2
    })
    // An outer shadow would be clipped into a square fringe by the widget
    // window, so appearance never adds one.
    expect(css).not.toContain('0 12px 34px')
    expect(css).toContain('.card { border-radius: 18px !important; }')
  })

  it('treats a changed border width as customization', () => {
    expect(hasCustomAppearance({ ...DEFAULT_WIDGET_APPEARANCE, borderWidth: 3 })).toBe(true)
    expect(hasCustomAppearance(DEFAULT_WIDGET_APPEARANCE)).toBe(false)
  })
})
