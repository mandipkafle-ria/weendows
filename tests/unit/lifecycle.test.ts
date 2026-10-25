import { describe, expect, it } from 'vitest'
import { parseAppFlags, parseWidgetCount } from '../../src/main/lifecycle'

describe('parseAppFlags', () => {
  it('defaults to showing the settings window', () => {
    expect(parseAppFlags([])).toEqual({ hidden: false, safe: false })
  })

  it('reads --hidden', () => {
    expect(parseAppFlags(['electron', '.', '--hidden'])).toEqual({
      hidden: true,
      safe: false
    })
  })

  it('reads --safe', () => {
    expect(parseAppFlags(['electron', '.', '--safe'])).toEqual({
      hidden: false,
      safe: true
    })
  })

  it('ignores unrelated arguments', () => {
    expect(parseAppFlags(['--remote-debugging-port=9222', '--hidden', 'value'])).toEqual({
      hidden: true,
      safe: false
    })
  })
})

describe('parseWidgetCount', () => {
  it('defaults to one widget', () => {
    expect(parseWidgetCount(undefined)).toBe(1)
    expect(parseWidgetCount('')).toBe(1)
  })

  it('reads a valid count', () => {
    expect(parseWidgetCount('3')).toBe(3)
    expect(parseWidgetCount('5')).toBe(5)
  })

  it('allows zero widgets', () => {
    expect(parseWidgetCount('0')).toBe(0)
  })

  it('falls back for invalid values', () => {
    expect(parseWidgetCount('abc')).toBe(1)
    expect(parseWidgetCount('-2')).toBe(1)
  })

  it('clamps runaway values', () => {
    expect(parseWidgetCount('99')).toBe(10)
  })
})
