import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppGridService } from '../../src/main/services/app-grid-service'
import { JsonStore } from '../../src/main/services/store'
import { appGridFileSchema, appGroupsFileSchema } from '../../src/shared/schemas'
import type { AppEntry, AppGridFile, AppGroupsFile } from '../../src/shared/types'

const app: AppEntry = {
  id: 'a',
  name: 'Alpha',
  kind: 'lnk',
  hidden: false,
  iconUrl: null
}

describe('app grid title', () => {
  it('persists a trimmed title without dropping grid items', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-grid-title-'))
    try {
      const grids = new JsonStore<AppGridFile>({
        file: join(root, 'grids.json'),
        schema: appGridFileSchema,
        defaults: () => ({ schema: 1, grids: {} }),
        debounceMs: 0
      })
      const groups = new JsonStore<AppGroupsFile>({
        file: join(root, 'groups.json'),
        schema: appGroupsFileSchema,
        defaults: () => ({ schema: 1, bundles: [] }),
        debounceMs: 0
      })
      const service = new AppGridService({
        grids,
        groups,
        scanner: { list: () => [app] }
      })
      await service.load()
      expect(service.state('grid').title).toBe('Apps')

      service.addApps('grid', ['a'])
      const state = service.renameTitle('grid', '  Focus  ')
      expect(state.title).toBe('Focus')
      expect(state.items).toHaveLength(1)
      await service.flush()

      const saved = JSON.parse(await readFile(join(root, 'grids.json'), 'utf8')) as AppGridFile
      expect(saved.grids.grid?.title).toBe('Focus')
      expect(saved.grids.grid?.items).toEqual([{ type: 'app', appId: 'a' }])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('ignores an empty title', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-grid-title-'))
    try {
      const grids = new JsonStore<AppGridFile>({
        file: join(root, 'grids.json'),
        schema: appGridFileSchema,
        defaults: () => ({ schema: 1, grids: {} }),
        debounceMs: 0
      })
      const groups = new JsonStore<AppGroupsFile>({
        file: join(root, 'groups.json'),
        schema: appGroupsFileSchema,
        defaults: () => ({ schema: 1, bundles: [] }),
        debounceMs: 0
      })
      const service = new AppGridService({ grids, groups, scanner: { list: () => [] } })
      await service.load()
      expect(service.renameTitle('grid', '   ').title).toBe('Apps')
      await service.flush()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
