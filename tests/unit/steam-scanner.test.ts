import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseSteamAppManifest,
  parseSteamLibraryFolders,
  scanSteamLibraries
} from '../../src/main/services/steam-scanner'

async function writeManifest(library: string, appId: string, name: string): Promise<void> {
  await mkdir(join(library, 'steamapps'), { recursive: true })
  await writeFile(
    join(library, 'steamapps', `appmanifest_${appId}.acf`),
    `"AppState"\n{\n  "appid" "${appId}"\n  "name" "${name}"\n}\n`,
    'utf8'
  )
}

describe('steam manifests', () => {
  it('parses app ids and names', () => {
    expect(
      parseSteamAppManifest('"AppState"\n{\n  "appid" "1422450"\n  "name" "Deadlock"\n}')
    ).toEqual({ appId: '1422450', name: 'Deadlock' })
    expect(parseSteamAppManifest('"AppState" {}')).toBeNull()
  })

  it('parses quoted library paths', () => {
    expect(
      parseSteamLibraryFolders(
        '"libraryfolders"\n{\n  "0"\n  {\n    "path" "C:\\\\Program Files (x86)\\\\Steam"\n  }\n  "1"\n  {\n    "path" "D:\\\\SteamLibrary"\n  }\n}'
      )
    ).toEqual(['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary'])
  })
})

describe('steam library scanning', () => {
  it('adds installed games, skips redistributables, and deduplicates app ids', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-steam-'))
    const extra = await mkdtemp(join(tmpdir(), 'homelayer-steam-library-'))
    try {
      await writeManifest(root, '1422450', 'Deadlock')
      await writeManifest(root, '228980', 'Steamworks Common Redistributables')
      await writeManifest(extra, '2767030', 'Marvel Rivals')
      await writeManifest(extra, '1422450', 'Deadlock duplicate')
      await mkdir(join(root, 'appcache', 'librarycache', '1422450'), { recursive: true })
      await writeFile(
        join(root, 'steamapps', 'libraryfolders.vdf'),
        `"libraryfolders"\n{\n  "1"\n  {\n    "path" "${extra.replace(/\\/g, '\\\\')}"\n  }\n}`,
        'utf8'
      )

      const apps = await scanSteamLibraries([root])
      expect(apps.map((app) => app.name).sort()).toEqual(['Deadlock', 'Marvel Rivals'])
      expect(apps.every((app) => app.kind === 'steam')).toBe(true)
      expect(apps.every((app) => app.iconUrl === null)).toBe(true)
      const deadlock = apps.find((app) => app.name === 'Deadlock')
      expect(deadlock?.steamAppId).toBe('1422450')
      expect(deadlock?.iconPath).toBe(join(root, 'appcache', 'librarycache', '1422450'))
      expect(new Set(apps.map((app) => app.id)).size).toBe(2)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(extra, { recursive: true, force: true })
    }
  })
})
