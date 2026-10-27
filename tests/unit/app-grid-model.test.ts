import { describe, expect, it } from 'vitest'
import {
  addApps,
  itemKey,
  mergeApp,
  moveItem,
  removeApp,
  removeFromBundle,
  reorderBundleApps,
  resolveGridState
} from '../../src/main/services/app-grid-model'
import type { AppBundleRecord, AppEntry, AppGridItemRef } from '../../src/shared/types'

function app(id: string, name = id): AppEntry {
  return { id, name, kind: 'lnk', hidden: false, iconUrl: null }
}

function bundle(id: string, appIds: string[]): AppBundleRecord {
  return { id, gridId: 'grid', name: 'Bundle', appIds }
}

describe('grid reorder', () => {
  const items: AppGridItemRef[] = [
    { type: 'app', appId: 'a' },
    { type: 'bundle', bundleId: 'b' },
    { type: 'app', appId: 'c' }
  ]

  it('moves an item forward and backward without mutating the source', () => {
    expect(moveItem(items, 0, 2).map(itemKey)).toEqual(['bundle:b', 'app:c', 'app:a'])
    expect(moveItem(items, 2, 0).map(itemKey)).toEqual(['app:c', 'app:a', 'bundle:b'])
    expect(items.map(itemKey)).toEqual(['app:a', 'bundle:b', 'app:c'])
  })

  it('ignores invalid indices', () => {
    expect(moveItem(items, -1, 2).map(itemKey)).toEqual(items.map(itemKey))
    expect(moveItem(items, 0, 9).map(itemKey)).toEqual(items.map(itemKey))
  })

  it('reorders apps inside a bundle', () => {
    const result = reorderBundleApps([bundle('b', ['a', 'b', 'c'])], 'b', 2, 0)
    expect(result[0]?.appIds).toEqual(['c', 'a', 'b'])
  })
})

describe('bundle merge', () => {
  it('creates a bundle when one app is dropped on another', () => {
    const items: AppGridItemRef[] = [
      { type: 'app', appId: 'a' },
      { type: 'app', appId: 'b' },
      { type: 'app', appId: 'c' }
    ]
    const result = mergeApp(items, [], 'grid', 'a', 'app:b', () => 'new-bundle')

    expect(result.items.map(itemKey)).toEqual(['bundle:new-bundle', 'app:c'])
    expect(result.bundles).toEqual([
      { id: 'new-bundle', gridId: 'grid', name: 'Bundle', appIds: ['b', 'a'] }
    ])
    expect(result.bundleId).toBe('new-bundle')
  })

  it('adds an app to an existing bundle and removes the source tile', () => {
    const items: AppGridItemRef[] = [
      { type: 'app', appId: 'a' },
      { type: 'bundle', bundleId: 'b' }
    ]
    const result = mergeApp(
      items,
      [bundle('b', ['b', 'c'])],
      'grid',
      'a',
      'bundle:b',
      () => 'unused'
    )

    expect(result.items.map(itemKey)).toEqual(['bundle:b'])
    expect(result.bundles[0]?.appIds).toEqual(['b', 'c', 'a'])
    expect(result.bundleId).toBe('b')
  })

  it('does not merge an app into itself or a missing target', () => {
    const items: AppGridItemRef[] = [{ type: 'app', appId: 'a' }]
    expect(mergeApp(items, [], 'grid', 'a', 'app:a', () => 'x').bundleId).toBeNull()
    expect(mergeApp(items, [], 'grid', 'a', 'app:missing', () => 'x').bundleId).toBeNull()
  })
})

describe('bundle dissolve', () => {
  it('puts the last app back on the grid when a bundle dissolves', () => {
    const items: AppGridItemRef[] = [
      { type: 'app', appId: 'a' },
      { type: 'bundle', bundleId: 'b' }
    ]
    const result = removeFromBundle(items, [bundle('b', ['b', 'c'])], 'b', 'c')

    expect(result.dissolved).toBe(true)
    expect(result.items.map(itemKey)).toEqual(['app:a', 'app:b', 'app:c'])
    expect(result.bundles).toEqual([])
  })

  it('puts the last app back when a single-app bundle is removed', () => {
    const items: AppGridItemRef[] = [{ type: 'bundle', bundleId: 'b' }]
    const result = removeFromBundle(items, [bundle('b', ['b'])], 'b', 'b')

    expect(result.dissolved).toBe(true)
    expect(result.items.map(itemKey)).toEqual(['app:b'])
    expect(result.bundles).toEqual([])
  })

  it('puts a removed app back while keeping a larger bundle', () => {
    const result = removeFromBundle(
      [{ type: 'bundle', bundleId: 'b' }],
      [bundle('b', ['a', 'b', 'c'])],
      'b',
      'b'
    )
    expect(result.dissolved).toBe(false)
    expect(result.items.map(itemKey)).toEqual(['bundle:b', 'app:b'])
    expect(result.bundles[0]?.appIds).toEqual(['a', 'c'])
  })
})

describe('adding and removing grid apps', () => {
  it('does not add an app that is already inside a bundle', () => {
    const result = addApps([{ type: 'bundle', bundleId: 'b' }], [bundle('b', ['a'])], ['a', 'c'])
    expect(result.added).toEqual(['c'])
    expect(result.items.map(itemKey)).toEqual(['bundle:b', 'app:c'])
  })

  it('removes an app from a bundle while keeping the other apps', () => {
    const result = removeApp(
      [{ type: 'bundle', bundleId: 'b' }],
      [bundle('b', ['a', 'b', 'c'])],
      'b'
    )
    expect(result.items.map(itemKey)).toEqual(['bundle:b'])
    expect(result.bundles[0]?.appIds).toEqual(['a', 'c'])
  })

  it('dissolves a bundle when removal leaves one app', () => {
    const result = removeApp([{ type: 'bundle', bundleId: 'b' }], [bundle('b', ['a', 'b'])], 'b')
    expect(result.items.map(itemKey)).toEqual(['app:a'])
    expect(result.dissolvedBundleIds).toEqual(['b'])
  })
})

describe('grid resolution', () => {
  it('resolves app and bundle items and drops missing apps', () => {
    const apps = [app('a', 'Alpha'), app('b', 'Beta')]
    const state = resolveGridState(
      'grid',
      [
        { type: 'app', appId: 'a' },
        { type: 'bundle', bundleId: 'b' },
        { type: 'app', appId: 'missing' }
      ],
      [bundle('b', ['b', 'missing'])],
      apps
    )

    expect(state.widgetId).toBe('grid')
    expect(state.title).toBe('Apps')
    expect(state.items).toHaveLength(2)
    expect(state.items[0]).toMatchObject({ type: 'app', app: { name: 'Alpha' } })
    expect(state.items[1]).toMatchObject({
      type: 'bundle',
      bundle: { name: 'Bundle', apps: [{ name: 'Beta' }] }
    })
  })
})
