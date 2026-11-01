import { describe, expect, it } from 'vitest'
import { findBuiltin } from '../../src/shared/builtins'
import { widgetContentSchema, widgetContentUpdateSchema } from '../../src/shared/schemas'
import { DEFAULT_WIDGET_APPEARANCE } from '../../src/shared/appearance'
import type { WidgetPlacement } from '../../src/shared/types'

function placement(overrides: Partial<WidgetPlacement> = {}): WidgetPlacement {
  return {
    widgetId: 'clock-1',
    displayId: 'primary',
    x: 0,
    y: 0,
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

describe('widget content schemas', () => {
  it('declares editable content for the extras widgets', () => {
    const keysByType: Record<string, string[]> = {
      agenda: ['items'],
      habits: ['habits'],
      water: ['cups', 'ml'],
      music: ['length', 'tracks'],
      quote: ['text', 'label']
    }
    for (const [type, keys] of Object.entries(keysByType)) {
      const builtin = findBuiltin(type)
      expect(builtin?.contentSchema, type).toBeTruthy()
      expect(builtin?.contentSchema?.fields.map((field) => field.key)).toEqual(keys)
    }
  })

  it('does not declare content for widgets without an editor', () => {
    expect(findBuiltin('clock')?.contentSchema).toBeUndefined()
    expect(findBuiltin('app-grid')?.contentSchema).toBeUndefined()
  })

  it('ships editable demo defaults that satisfy the schema', () => {
    for (const type of ['agenda', 'habits', 'water', 'music', 'quote']) {
      const builtin = findBuiltin(type)
      const defaults = builtin?.contentDefaults
      expect(defaults, type).toBeTruthy()
      expect(widgetContentSchema.parse(defaults), type).toEqual(defaults)
      const schemaKeys = new Set(builtin?.contentSchema?.fields.map((field) => field.key))
      for (const key of Object.keys(defaults ?? {})) {
        expect(schemaKeys.has(key), `${type}.${key}`).toBe(true)
      }
    }
  })

  it('accepts nested content values', () => {
    const content = {
      items: [
        { time: '08:30', minutes: 30, title: 'Standup' },
        { time: '10:00', minutes: 90, title: 'Design review' }
      ],
      note: 'hello',
      count: 3,
      flag: true,
      empty: null
    }
    expect(widgetContentSchema.parse(content)).toEqual(content)
  })

  it('rejects oversized content', () => {
    const big: Record<string, string> = {}
    for (let index = 0; index < 300; index += 1) {
      big[`key${index}`] = 'x'.repeat(100)
    }
    expect(() => widgetContentSchema.parse(big)).toThrow()
  })

  it('rejects deeply invalid content types', () => {
    expect(() => widgetContentSchema.parse('not a record')).toThrow()
    expect(() => widgetContentSchema.parse({ nested: { bad: undefined } })).toThrow()
  })

  it('validates update payloads', () => {
    const parsed = widgetContentUpdateSchema.parse({
      widgetId: 'music-1',
      content: { tracks: [{ title: 'Slow Orbit', artist: 'Halden' }], length: 213 }
    })
    expect(parsed.widgetId).toBe('music-1')
    expect(parsed.content).toEqual({
      tracks: [{ title: 'Slow Orbit', artist: 'Halden' }],
      length: 213
    })
    expect(() => widgetContentUpdateSchema.parse({ widgetId: 'Bad Id', content: {} })).toThrow()
  })

  it('keeps content on widget placements', () => {
    const parsed = placement({ content: { text: 'hello' } })
    expect(parsed.content).toEqual({ text: 'hello' })
    expect(placement().content).toBeUndefined()
  })
})
