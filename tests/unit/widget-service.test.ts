import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonStore } from '../../src/main/services/store'
import { WidgetService } from '../../src/main/services/widget-service'
import { findBuiltin } from '../../src/shared/builtins'
import { layoutFileSchema } from '../../src/shared/schemas'
import type { AiManifest, LayoutFile, WidgetPlacement } from '../../src/shared/types'

const roots: string[] = []
const stores: JsonStore<LayoutFile>[] = []
let sequence = 0

function placement(overrides: Partial<WidgetPlacement> = {}): Omit<WidgetPlacement, 'widgetId'> {
  return {
    displayId: 'primary',
    x: 10,
    y: 20,
    width: 240,
    height: 140,
    zOrder: 1,
    locked: false,
    enabled: true,
    opacity: 1,
    ...overrides
  }
}

async function makeService(): Promise<{ service: WidgetService; widgetsDir: string }> {
  const root = await mkdtemp(join(tmpdir(), 'homelayer-widget-service-'))
  roots.push(root)
  const widgetsDir = join(root, 'widgets')
  const layout = new JsonStore<LayoutFile>({
    file: join(root, 'layout.json'),
    schema: layoutFileSchema,
    defaults: () => ({ schema: 1, placements: [] }),
    debounceMs: 10
  })
  stores.push(layout)

  const builtinsDir = join(root, 'builtins')
  await mkdir(join(builtinsDir, 'clock'), { recursive: true })
  await writeFile(join(builtinsDir, 'clock', 'index.html'), '<!doctype html><title>Clock</title>')

  const service = new WidgetService({
    widgetsDir,
    builtinsDir,
    layout,
    now: () => '2026-10-26T12:00:00.000Z',
    createId: () => `ai-test-${++sequence}`
  })
  await service.load()
  return { service, widgetsDir }
}

async function createSavedWidget(service: WidgetService): Promise<string> {
  const manifest: AiManifest = {
    name: 'Saved stats',
    width: 240,
    height: 140,
    minWidth: 180,
    minHeight: 120,
    permissions: [],
    allowedHosts: []
  }
  const summary = await service.createAiWidget(
    manifest,
    '<html>saved</html>',
    placement(),
    'show saved stats',
    { permissions: [], allowedHosts: [] }
  )
  return summary.manifest.id
}

afterEach(async () => {
  for (const store of stores.splice(0)) {
    await store.close()
  }
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

describe('built-in variants', () => {
  it('installs the requested design and applies its dimensions', async () => {
    const { service } = await makeService()
    const clock = findBuiltin('clock')
    if (!clock) {
      throw new Error('Clock built-in is missing')
    }

    const summary = await service.create(clock, placement(), 'analog')

    expect(summary.manifest.variant).toBe('analog')
    expect(summary.manifest.width).toBe(240)
    expect(summary.manifest.height).toBe(240)
    expect(summary.manifest.minWidth).toBe(180)
    expect(summary.manifest.minHeight).toBe(180)
  })

  it('switches designs and rejects an unknown one', async () => {
    const { service } = await makeService()
    const clock = findBuiltin('clock')
    if (!clock) {
      throw new Error('Clock built-in is missing')
    }

    const summary = await service.create(clock, placement())
    expect(summary.manifest.variant).toBe('classic')

    service.updatePlacement(summary.manifest.id, { width: 420, height: 300 })
    const updated = await service.setBuiltinVariant(summary.manifest.id, 'neon')
    expect(updated.variant).toBe('neon')
    expect(updated.width).toBe(300)
    expect(updated.height).toBe(160)
    expect(service.getPlacement(summary.manifest.id)).toMatchObject({ width: 420, height: 300 })

    await expect(service.setBuiltinVariant(summary.manifest.id, 'missing')).rejects.toThrow(
      'Unknown design: missing'
    )
  })

  it('clamps a placement below the new design minimum', async () => {
    const { service } = await makeService()
    const clock = findBuiltin('clock')
    if (!clock) {
      throw new Error('Clock built-in is missing')
    }

    const summary = await service.create(clock, placement({ width: 170, height: 105 }))
    const updated = await service.setBuiltinVariant(summary.manifest.id, 'terminal')

    expect(updated.variant).toBe('terminal')
    expect(service.getPlacement(summary.manifest.id)).toMatchObject({ width: 225, height: 120 })
  })
})

describe('saved AI widgets', () => {
  it('keeps the widget files when it is removed from the desktop', async () => {
    const { service, widgetsDir } = await makeService()
    const widgetId = await createSavedWidget(service)

    expect(service.listSavedAiWidgets()).toEqual([])
    expect(await service.remove(widgetId)).toBe(true)

    expect(service.getPlacement(widgetId)).toBeNull()
    await expect(access(join(widgetsDir, widgetId, 'index.html'))).resolves.toBeUndefined()
    expect(service.listSavedAiWidgets().map((manifest) => manifest.id)).toEqual([widgetId])
  })

  it('creates a copy and leaves the saved source available', async () => {
    const { service, widgetsDir } = await makeService()
    const widgetId = await createSavedWidget(service)
    await service.remove(widgetId)

    const copy = await service.duplicate(widgetId, placement({ zOrder: 2 }))

    expect(copy.manifest.id).not.toBe(widgetId)
    expect(copy.manifest.name).toBe('Saved stats copy')
    expect(copy.placement.widgetId).toBe(copy.manifest.id)
    expect(service.getPlacement(copy.manifest.id)).not.toBeNull()
    expect(service.listSavedAiWidgets().map((manifest) => manifest.id)).toEqual([widgetId])
    await expect(readFile(join(widgetsDir, copy.manifest.id, 'index.html'), 'utf8')).resolves.toBe(
      '<html>saved</html>'
    )
  })

  it('deletes a saved widget permanently', async () => {
    const { service, widgetsDir } = await makeService()
    const widgetId = await createSavedWidget(service)
    await service.remove(widgetId)

    expect(await service.delete(widgetId)).toBe(true)
    expect(service.getManifest(widgetId)).toBeNull()
    await expect(access(join(widgetsDir, widgetId))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
