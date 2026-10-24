import { describe, expect, it } from 'vitest'
import { parseAppFlags } from '../../src/main/lifecycle'

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
