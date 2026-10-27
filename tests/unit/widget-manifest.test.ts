import { describe, expect, it } from 'vitest'
import {
  BUILTIN_WIDGETS,
  builtinVariant,
  findBuiltin,
  findBuiltinVariant,
  isFocusableWidget
} from '../../src/shared/builtins'
import { widgetManifestSchema } from '../../src/shared/schemas'
import { effectiveMinSize, minimumSizeFor } from '../../src/shared/widget-size'
import type { WidgetManifest } from '../../src/shared/types'

const baseManifest = {
  schema: 1,
  id: 'test-widget',
  name: 'Test widget',
  kind: 'builtin',
  builtinType: 'notes',
  width: 280,
  height: 220,
  permissions: [],
  grantedPermissions: [],
  allowedHosts: [],
  createdAt: '2026-10-25T00:00:00.000Z',
  updatedAt: '2026-10-25T00:00:00.000Z'
} as const

describe('widget minimum sizes', () => {
  it('applies a 75 percent readable floor to AI widgets', () => {
    expect(minimumSizeFor(240, 240)).toEqual({ minWidth: 180, minHeight: 180 })
    expect(minimumSizeFor(240, 140)).toEqual({ minWidth: 180, minHeight: 120 })
  })

  it('keeps a larger AI minimum and clamps it to the design size', () => {
    expect(minimumSizeFor(240, 240, { minWidth: 220, minHeight: 230 })).toEqual({
      minWidth: 220,
      minHeight: 230
    })
    expect(minimumSizeFor(240, 240, { minWidth: 500, minHeight: 500 })).toEqual({
      minWidth: 240,
      minHeight: 240
    })
  })

  it('uses stored minimums for built-in widgets', () => {
    const manifest = widgetManifestSchema.parse({
      ...baseManifest,
      minWidth: 200,
      minHeight: 160
    })
    expect(effectiveMinSize(manifest as WidgetManifest)).toEqual({
      minWidth: 200,
      minHeight: 160
    })
  })

  it('raises an old AI manifest minimum when it is loaded', () => {
    const manifest = widgetManifestSchema.parse({
      ...baseManifest,
      kind: 'ai',
      width: 240,
      height: 240,
      minWidth: 120,
      minHeight: 120
    })
    expect(effectiveMinSize(manifest as WidgetManifest)).toEqual({
      minWidth: 180,
      minHeight: 180
    })
  })
})

describe('built-in variants', () => {
  it('gives every built-in a unique default design that matches its base size', () => {
    for (const builtin of BUILTIN_WIDGETS) {
      const ids = builtin.variants.map((variant) => variant.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(builtin.variants.length).toBeGreaterThan(0)

      const first = builtin.variants[0]
      expect(first?.width).toBe(builtin.width)
      expect(first?.height).toBe(builtin.height)
    }
  })

  it('falls back to the default when a design is omitted or unknown', () => {
    const clock = findBuiltin('clock')
    if (!clock) {
      throw new Error('Clock built-in is missing')
    }

    expect(findBuiltinVariant(clock, undefined).id).toBe('classic')
    expect(findBuiltinVariant(clock, 'missing').id).toBe('classic')
    expect(builtinVariant('clock', 'analog')?.id).toBe('analog')
    expect(builtinVariant(undefined, 'analog')).toBeNull()
    expect(builtinVariant('missing', 'analog')).toBeNull()
  })

  it('accepts a valid design id and rejects malformed ones', () => {
    expect(widgetManifestSchema.parse({ ...baseManifest, variant: 'analog' }).variant).toBe(
      'analog'
    )
    expect(widgetManifestSchema.safeParse({ ...baseManifest, variant: 'Analog' }).success).toBe(
      false
    )
    expect(widgetManifestSchema.safeParse({ ...baseManifest, variant: '../analog' }).success).toBe(
      false
    )
  })
})

describe('widget focus metadata', () => {
  it('keeps focusable optional for older manifests', () => {
    const manifest = widgetManifestSchema.parse(baseManifest)
    expect(manifest.focusable).toBeUndefined()
    expect(isFocusableWidget(manifest as WidgetManifest)).toBe(true)
  })

  it('lets an explicit manifest value override the built-in default', () => {
    const manifest = widgetManifestSchema.parse({ ...baseManifest, focusable: false })
    expect(manifest.focusable).toBe(false)
    expect(isFocusableWidget(manifest as WidgetManifest)).toBe(false)
  })

  it('marks only Notes and Weather as focusable built-ins', () => {
    expect(findBuiltin('notes')?.focusable).toBe(true)
    expect(findBuiltin('weather')?.focusable).toBe(true)
    expect(findBuiltin('clock')?.focusable).toBeUndefined()
    expect(findBuiltin('system')?.focusable).toBeUndefined()
    expect(findBuiltin('battery')?.focusable).toBeUndefined()
  })
})
