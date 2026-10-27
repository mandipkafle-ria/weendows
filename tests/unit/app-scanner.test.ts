import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AppScanner,
  dedupeClassicEntries,
  isHiddenAppName,
  makeClassicEntry,
  parseStartApps,
  scanClassicShortcuts,
  type ShortcutLink
} from '../../src/main/services/app-scanner'

interface FakeEntry {
  name: string
  isDirectory: boolean
}

function tree(entries: Record<string, FakeEntry[]>): (directory: string) => Promise<FakeEntry[]> {
  return async (directory) => entries[directory] ?? []
}

describe('app scanner filtering', () => {
  it('finds shortcuts recursively, flags hidden names, and skips non-links', async () => {
    const root = 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
    const tools = `${root}\\Tools`
    const shortcuts: Record<string, ShortcutLink> = {
      [`${root}\\Firefox.lnk`]: { target: 'C:\\Firefox\\firefox.exe' },
      [`${tools}\\Readme.lnk`]: { target: 'C:\\Tools\\readme.txt' },
      [`${tools}\\Broken.lnk`]: { target: 'C:\\Broken\\broken.exe' }
    }

    const apps = await scanClassicShortcuts({
      roots: [root],
      readDirectory: tree({
        [root]: [
          { name: 'Firefox.lnk', isDirectory: false },
          { name: 'notes.txt', isDirectory: false },
          { name: 'Tools', isDirectory: true }
        ],
        [tools]: [
          { name: 'Readme.lnk', isDirectory: false },
          { name: 'Broken.lnk', isDirectory: false }
        ]
      }),
      readShortcut: (path) => {
        if (path.endsWith('Broken.lnk')) {
          throw new Error('unreadable')
        }
        const shortcut = shortcuts[path]
        if (!shortcut) {
          throw new Error('missing fixture')
        }
        return shortcut
      }
    })

    expect(apps.map((app) => app.name)).toEqual(['Firefox', 'Readme'])
    expect(apps[0]?.hidden).toBe(false)
    expect(apps[0]?.iconPath).toBe('C:\\Firefox\\firefox.exe')
    expect(apps[1]?.hidden).toBe(true)
    expect(isHiddenAppName('Uninstall Example')).toBe(true)
    expect(isHiddenAppName('Example')).toBe(false)
  })

  it('de-duplicates by target and arguments, preferring a visible entry', () => {
    const hidden = makeClassicEntry(
      'C:\\Menu\\Uninstall Thing.lnk',
      'Uninstall Thing',
      { target: 'C:\\Thing\\thing.exe', args: '--uninstall' },
      (value) => value
    )
    const visible = makeClassicEntry(
      'C:\\Menu\\Thing.lnk',
      'Thing',
      { target: 'C:\\Thing\\thing.exe', args: '--uninstall' },
      (value) => value
    )
    const otherArgs = makeClassicEntry(
      'C:\\Menu\\Thing Safe.lnk',
      'Thing Safe',
      { target: 'C:\\Thing\\thing.exe', args: '--safe' },
      (value) => value
    )

    const result = dedupeClassicEntries([hidden, visible, otherArgs])
    expect(result.map((app) => app.name)).toEqual(['Thing', 'Thing Safe'])
  })

  it('uses the shortcut path as the key when the target is empty', () => {
    const first = makeClassicEntry('C:\\Menu\\One.lnk', 'One', { target: '' }, (value) => value)
    const second = makeClassicEntry('C:\\Menu\\Two.lnk', 'Two', { target: '' }, (value) => value)

    const result = dedupeClassicEntries([first, second])
    expect(result.map((app) => app.name)).toEqual(['One', 'Two'])
    expect(result.every((app) => app.iconPath === undefined)).toBe(true)
  })
})

describe('store app parsing', () => {
  it('keeps only packaged AppIDs, normalizes names, and removes duplicates', () => {
    const apps = parseStartApps(
      [
        { Name: ' Settings ', AppID: 'Microsoft.Windows.Settings_8wekyb3d8bbwe!App' },
        { Name: 'Settings duplicate', AppID: 'microsoft.windows.settings_8wekyb3d8bbwe!app' },
        { Name: 'Classic app', AppID: 'ClassicApp' },
        { Name: '', AppID: 'Microsoft.Empty_8wekyb3d8bbwe!App' }
      ],
      (value) => value
    )

    expect(apps).toHaveLength(1)
    expect(apps[0]?.name).toBe('Settings')
    expect(apps[0]?.kind).toBe('uwp')
    expect(apps[0]?.iconUrl).toBeNull()
  })

  it('keeps the manifest icon path from Start apps', () => {
    const apps = parseStartApps(
      {
        Name: 'Calculator',
        AppID: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App',
        IconPath: 'C:\\Program Files\\WindowsApps\\Calculator\\Assets\\CalculatorAppList.png'
      },
      (value) => value
    )
    expect(apps[0]?.iconPath).toBe(
      'C:\\Program Files\\WindowsApps\\Calculator\\Assets\\CalculatorAppList.png'
    )
  })

  it('accepts a single object from ConvertTo-Json', () => {
    const apps = parseStartApps(
      { Name: 'Calculator', AppID: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App' },
      (value) => value
    )
    expect(apps.map((app) => app.name)).toEqual(['Calculator'])
  })
})

describe('app icon extraction', () => {
  it('extracts the target icon and caches it by shortcut mtime', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-icons-'))
    try {
      const shortcut = join(root, 'Test.lnk')
      const target = join(root, 'app.exe')
      const iconsDir = join(root, 'icons')
      await writeFile(shortcut, '')
      await writeFile(target, '')
      const calls: string[] = []
      const scanner = new AppScanner({
        roots: [root],
        iconsDir,
        readShortcut: () => ({ target }),
        getFileIcon: async (path) => {
          calls.push(path)
          return { toPNG: () => Buffer.from([1, 2, 3]) }
        },
        listStartApps: async () => '[]'
      })

      const apps = await scanner.refresh()
      const id = apps[0]!.id
      expect(calls).toEqual([target])
      expect(apps[0]?.iconUrl).toBe(`hl-icon://${id}`)
      expect(await readFile(join(iconsDir, `${id}.png`))).toEqual(Buffer.from([1, 2, 3]))

      await scanner.refresh()
      expect(calls).toEqual([target])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('removes cached icons when the target icon cannot be read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-icons-'))
    try {
      const shortcut = join(root, 'Test.lnk')
      const target = join(root, 'app.exe')
      const iconsDir = join(root, 'icons')
      await writeFile(shortcut, '')
      await writeFile(target, '')
      let fail = false
      const scanner = new AppScanner({
        roots: [root],
        iconsDir,
        readShortcut: () => ({ target }),
        getFileIcon: async () => {
          if (fail) {
            throw new Error('missing')
          }
          return { toPNG: () => Buffer.from([9]) }
        },
        listStartApps: async () => '[]'
      })

      const apps = await scanner.refresh()
      const id = apps[0]!.id
      expect(await readFile(join(iconsDir, `${id}.png`))).toEqual(Buffer.from([9]))

      fail = true
      await rm(target, { force: true })
      await writeFile(
        join(iconsDir, `${id}.json`),
        JSON.stringify({ mtimeMs: 0, source: target }),
        'utf8'
      )
      const afterFailure = await scanner.refresh()
      expect(afterFailure[0]?.iconUrl).toBeNull()
      await expect(readFile(join(iconsDir, `${id}.png`))).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not advertise an icon for a shortcut without a target', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-icons-'))
    try {
      await writeFile(join(root, 'Empty.lnk'), '')
      const calls: string[] = []
      const scanner = new AppScanner({
        roots: [root],
        iconsDir: join(root, 'icons'),
        readShortcut: () => ({ target: '' }),
        getFileIcon: async (path) => {
          calls.push(path)
          return { toPNG: () => Buffer.from([1]) }
        },
        listStartApps: async () => '[]'
      })

      const apps = await scanner.refresh()
      expect(apps[0]?.iconUrl).toBeNull()
      expect(calls).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('resolves a packaged app icon variant from the manifest path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-uwp-'))
    try {
      const menu = join(root, 'menu')
      const assets = join(root, 'assets')
      await mkdir(menu, { recursive: true })
      await mkdir(assets, { recursive: true })
      const base = join(assets, 'CalculatorAppList.png')
      const variant = join(assets, 'CalculatorAppList.targetsize-48_altform-lightunplated.png')
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
      await writeFile(variant, png)
      const scanner = new AppScanner({
        roots: [menu],
        iconsDir: join(root, 'icons'),
        readShortcut: () => {
          throw new Error('unexpected shortcut')
        },
        getFileIcon: async () => {
          throw new Error('unexpected classic icon')
        },
        listStartApps: async () =>
          JSON.stringify([
            {
              Name: 'Calculator',
              AppID: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App',
              IconPath: base
            }
          ])
      })

      const apps = await scanner.refresh()
      const id = apps[0]!.id
      expect(apps[0]?.iconUrl).toBe(`hl-icon://${id}`)
      expect(await readFile(join(root, 'icons', `${id}.png`))).toEqual(png)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('falls back to the shortcut icon location when the target has no icon', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-fallback-'))
    try {
      const shortcut = join(root, 'Explorer.lnk')
      const target = join(root, 'missing.exe')
      const fallback = join(root, 'explorer.exe')
      await writeFile(shortcut, '')
      await writeFile(target, '')
      await writeFile(fallback, '')
      const calls: string[] = []
      const scanner = new AppScanner({
        roots: [root],
        iconsDir: join(root, 'icons'),
        readShortcut: () => ({ target, icon: `${fallback},0` }),
        getFileIcon: async (path) => {
          calls.push(path)
          if (path === target) throw new Error('no icon')
          return { toPNG: () => Buffer.from([7]) }
        },
        listStartApps: async () => '[]'
      })

      const apps = await scanner.refresh()
      expect(calls).toEqual([target, fallback])
      expect(apps[0]?.iconUrl).not.toBeNull()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('prefers a classic shortcut over a duplicate Start app', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-duplicate-'))
    try {
      const target = join(root, 'tool.exe')
      await writeFile(join(root, 'Office Tool.lnk'), '')
      await writeFile(target, '')
      const scanner = new AppScanner({
        roots: [root],
        iconsDir: join(root, 'icons'),
        readShortcut: () => ({ target }),
        getFileIcon: async () => ({ toPNG: () => Buffer.from([3]) }),
        listStartApps: async () =>
          JSON.stringify([{ Name: 'Office Tool', AppID: 'Office.Tool!App' }])
      })

      const apps = await scanner.refresh()
      expect(apps).toHaveLength(1)
      expect(apps[0]?.kind).toBe('lnk')
      expect(apps[0]?.iconUrl).not.toBeNull()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('includes Steam library games and their library cache art', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-steam-app-'))
    try {
      const menu = join(root, 'menu')
      const steam = join(root, 'Steam')
      await mkdir(menu, { recursive: true })
      await mkdir(join(steam, 'steamapps'), { recursive: true })
      await writeFile(
        join(steam, 'steamapps', 'appmanifest_42.acf'),
        '"AppState"\n{\n  "appid" "42"\n  "name" "Test Game"\n}\n',
        'utf8'
      )
      const artDir = join(steam, 'appcache', 'librarycache', '42')
      await mkdir(artDir, { recursive: true })
      const art = join(artDir, 'deadbeef.jpg')
      await writeFile(art, '')
      const scanner = new AppScanner({
        roots: [menu],
        iconsDir: join(root, 'icons'),
        readShortcut: () => {
          throw new Error('unexpected shortcut')
        },
        getFileIcon: async () => {
          throw new Error('unexpected classic icon')
        },
        createImage: () => ({
          getSize: () => ({ width: 32, height: 32 }),
          toPNG: () => Buffer.from([8])
        }),
        listStartApps: async () => '[]',
        steamRoots: async () => [steam]
      })

      const apps = await scanner.refresh()
      expect(apps.map((app) => app.name)).toEqual(['Test Game'])
      expect(apps[0]?.kind).toBe('steam')
      expect(apps[0]?.iconUrl).not.toBeNull()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
