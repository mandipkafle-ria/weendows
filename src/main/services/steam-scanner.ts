import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ScannedApp } from './app-scanner'

const STEAM_SKIP_RE = /steamworks common redistributables|steam linux runtime|proton/i

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex')
}

function steamCandidates(): string[] {
  const candidates: string[] = []
  const programFilesX86 = process.env['ProgramFiles(x86)']
  const programFiles = process.env['ProgramFiles']
  const localAppData = process.env['LOCALAPPDATA']
  if (programFilesX86) candidates.push(join(programFilesX86, 'Steam'))
  if (programFiles) candidates.push(join(programFiles, 'Steam'))
  if (localAppData) candidates.push(join(localAppData, 'Steam'))
  return candidates
}

export function parseSteamLibraryFolders(raw: string): string[] {
  const paths: string[] = []
  const pattern = /"path"\s+"((?:\\.|[^"])*)"/g
  for (const match of raw.matchAll(pattern)) {
    const value = match[1]?.replace(/\\\\/g, '\\').trim()
    if (value) paths.push(value)
  }
  return paths
}

export function parseSteamAppManifest(raw: string): { appId: string; name: string } | null {
  const appId = /"appid"\s+"(\d+)"/.exec(raw)?.[1]
  const name = /"name"\s+"((?:\\.|[^"])*)"/.exec(raw)?.[1]?.replace(/\\"/g, '"').trim()
  if (!appId || !name) return null
  return { appId, name }
}

export async function discoverSteamRoots(): Promise<string[]> {
  const roots = new Set<string>()
  for (const candidate of steamCandidates()) {
    if (existsSync(join(candidate, 'steamapps'))) {
      roots.add(candidate)
    }
  }

  for (const root of [...roots]) {
    try {
      const raw = await readFile(join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8')
      for (const library of parseSteamLibraryFolders(raw)) {
        if (existsSync(join(library, 'steamapps'))) {
          roots.add(library)
        }
      }
    } catch {
      // A missing libraryfolders.vdf is normal for a new or custom Steam install.
    }
  }

  return [...roots]
}

export async function scanSteamLibraries(roots: readonly string[]): Promise<ScannedApp[]> {
  const libraries = new Set<string>()
  for (const root of roots) {
    libraries.add(root)
    try {
      const raw = await readFile(join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8')
      for (const library of parseSteamLibraryFolders(raw)) {
        libraries.add(library)
      }
    } catch {
      // Ignore libraries without a readable folder list.
    }
  }

  const mainRoot = roots[0]
  const apps: ScannedApp[] = []
  const seen = new Set<string>()
  for (const library of libraries) {
    let entries
    try {
      entries = await readdir(join(library, 'steamapps'), { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isFile() || !/^appmanifest_\d+\.acf$/i.test(entry.name)) continue
      let manifest
      try {
        manifest = parseSteamAppManifest(
          await readFile(join(library, 'steamapps', entry.name), 'utf8')
        )
      } catch {
        continue
      }
      if (!manifest || seen.has(manifest.appId) || STEAM_SKIP_RE.test(manifest.name)) {
        continue
      }
      seen.add(manifest.appId)
      apps.push({
        id: sha1(`steam:${manifest.appId}`),
        name: manifest.name,
        kind: 'steam',
        hidden: false,
        iconUrl: null,
        steamAppId: manifest.appId,
        iconPath: mainRoot ? join(mainRoot, 'appcache', 'librarycache', manifest.appId) : undefined
      })
    }
  }

  return apps
}
