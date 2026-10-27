import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { watch, type FSWatcher } from 'node:fs'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { promisify } from 'node:util'
import { APP_ICON_ID_RE, APP_SCAN_DEBOUNCE_MS, APP_SCAN_TIMEOUT_MS } from '../../shared/constants'
import type { AppEntry } from '../../shared/types'
import { scanSteamLibraries } from './steam-scanner'

const runFile = promisify(execFile)
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export const HIDDEN_APP_NAME_RE =
  /uninstall|readme|release notes|documentation|user guide|help|license|website|manual/i

export interface ShortcutLink {
  target: string
  args?: string
  icon?: string
  iconIndex?: number
}

export interface NativeImageLike {
  toPNG: () => Buffer
  getSize?: () => { width: number; height: number }
  isEmpty?: () => boolean
}

export interface ScannedApp extends AppEntry {
  launchPath?: string
  iconPath?: string
  iconFallbackPath?: string
  appUserModelId?: string
  steamAppId?: string
  mtimeMs?: number
}

export interface ClassicScanOptions {
  roots: readonly string[]
  readDirectory?: (directory: string) => Promise<Array<{ name: string; isDirectory: boolean }>>
  readShortcut?: (path: string) => ShortcutLink
  hash?: (value: string) => string
}

export interface AppScannerOptions {
  roots: readonly string[]
  iconsDir: string
  readShortcut: (path: string) => ShortcutLink
  getFileIcon: (path: string) => Promise<NativeImageLike>
  createImage?: (path: string) => NativeImageLike
  listStartApps?: () => Promise<string>
  steamRoots?: () => Promise<readonly string[]>
  debounceMs?: number
}

interface DedupeEntry {
  key: string
  app: ScannedApp
}

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex')
}

export function isHiddenAppName(name: string): boolean {
  return HIDDEN_APP_NAME_RE.test(name)
}

export function iconUrlForId(id: string): string {
  return `hl-icon://${id}`
}

export function expandEnvPath(value: string): string {
  return value.replace(/%([^%]+)%/g, (_match, name: string) => {
    const key = Object.keys(process.env).find(
      (candidate) => candidate.toLowerCase() === name.toLowerCase()
    )
    return key ? (process.env[key] ?? '') : ''
  })
}

function isPng(value: Buffer): boolean {
  return (
    value.length >= PNG_SIGNATURE.length &&
    value.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  )
}

async function resolveUwpIconFile(basePath: string): Promise<string | null> {
  const direct = await stat(basePath).catch(() => null)
  if (direct?.isFile()) {
    return basePath
  }

  const directory = dirname(basePath)
  const extension = extname(basePath) || '.png'
  const stem = basename(basePath, extension)
  const entries = await readdir(directory).catch(() => [] as string[])
  const candidates = entries.filter(
    (name) =>
      name.startsWith(`${stem}.`) && name.toLowerCase().endsWith('.png') && !/contrast/i.test(name)
  )
  const preferences = [
    `${stem}.targetsize-48_altform-lightunplated.png`,
    `${stem}.targetsize-48_altform-unplated.png`,
    `${stem}.targetsize-48.png`,
    `${stem}.targetsize-64_altform-lightunplated.png`,
    `${stem}.targetsize-64.png`,
    `${stem}.targetsize-96.png`,
    `${stem}.targetsize-256.png`,
    `${stem}.scale-200.png`,
    `${stem}.scale-100.png`
  ]
  for (const preference of preferences) {
    if (candidates.includes(preference)) {
      return join(directory, preference)
    }
  }
  return candidates[0] ? join(directory, candidates[0]) : null
}

export function shortcutKey(shortcutPath: string, shortcut: ShortcutLink): string {
  const target = shortcut.target.trim()
  if (!target) {
    return shortcutPath.toLowerCase()
  }
  return `${target}|${shortcut.args ?? ''}`.toLowerCase()
}

export function makeClassicEntry(
  shortcutPath: string,
  name: string,
  shortcut: ShortcutLink,
  hash: (value: string) => string = sha1
): DedupeEntry {
  const key = shortcutKey(shortcutPath, shortcut)
  const id = hash(`lnk:${key}`)
  return {
    key,
    app: {
      id,
      name,
      kind: 'lnk',
      hidden: isHiddenAppName(name),
      iconUrl: null,
      launchPath: shortcutPath,
      iconPath: shortcut.target.trim() || undefined,
      iconFallbackPath: shortcut.icon?.split(',')[0]?.trim() || undefined
    }
  }
}

export function dedupeClassicEntries(entries: readonly DedupeEntry[]): ScannedApp[] {
  const seen = new Map<string, DedupeEntry>()
  for (const entry of entries) {
    const existing = seen.get(entry.key)
    if (!existing) {
      seen.set(entry.key, entry)
      continue
    }
    if (existing.app.hidden && !entry.app.hidden) {
      seen.set(entry.key, entry)
    }
  }
  return [...seen.values()].map((entry) => entry.app)
}

async function walk(
  directory: string,
  readDirectory: NonNullable<ClassicScanOptions['readDirectory']>,
  out: string[]
): Promise<void> {
  let entries: Array<{ name: string; isDirectory: boolean }>
  try {
    entries = await readDirectory(directory)
  } catch {
    return
  }

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory) {
      await walk(path, readDirectory, out)
    } else if (entry.name.toLowerCase().endsWith('.lnk')) {
      out.push(path)
    }
  }
}

export async function scanClassicShortcuts(options: ClassicScanOptions): Promise<ScannedApp[]> {
  const readDirectory =
    options.readDirectory ??
    (async (directory: string) => {
      const entries = await readdir(directory, { withFileTypes: true })
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory()
      }))
    })
  const readShortcut = options.readShortcut ?? (() => ({ target: '' }))
  const hash = options.hash ?? sha1
  const files: string[] = []

  for (const root of options.roots) {
    await walk(root, readDirectory, files)
  }

  const entries: DedupeEntry[] = []
  for (const file of files) {
    const name = basename(file, '.lnk')
    try {
      const shortcut = readShortcut(file)
      entries.push(makeClassicEntry(file, name, shortcut, hash))
    } catch {
      // Unreadable shortcuts are skipped.
    }
  }

  return dedupeClassicEntries(entries)
}

export function parseStartApps(raw: unknown, hash: (value: string) => string = sha1): ScannedApp[] {
  const items = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []
  const apps: ScannedApp[] = []
  const seen = new Set<string>()

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const record = item as Record<string, unknown>
    const name = typeof record['Name'] === 'string' ? record['Name'].trim() : ''
    const appUserModelId = typeof record['AppID'] === 'string' ? record['AppID'].trim() : ''
    const iconPath = typeof record['IconPath'] === 'string' ? record['IconPath'].trim() : ''
    if (!name || !appUserModelId.includes('!')) {
      continue
    }
    const key = appUserModelId.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    apps.push({
      id: hash(`uwp:${key}`),
      name,
      kind: 'uwp',
      hidden: false,
      iconUrl: null,
      appUserModelId,
      iconPath: iconPath || undefined
    })
  }

  return apps
}

async function defaultListStartApps(): Promise<string> {
  const script = [
    '$startApps = @(Get-StartApps)',
    '$families = @{}',
    'foreach ($app in $startApps) {',
    '  $family = $app.AppID.Split("!")[0]',
    '  if ($family) { $families[$family] = $true }',
    '}',
    '$icons = @{}',
    'foreach ($package in @(Get-AppxPackage)) {',
    '  if (-not $families.ContainsKey($package.PackageFamilyName)) { continue }',
    '  $logo = $null',
    '  try {',
    '    $manifestPath = Join-Path $package.InstallLocation "AppxManifest.xml"',
    '    if (Test-Path -LiteralPath $manifestPath) {',
    '      [xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw',
    '      $applications = @($manifest.Package.Applications.Application)',
    '      $application = $applications | Where-Object { $_.Id -eq "App" } | Select-Object -First 1',
    '      if (-not $application) { $application = $applications | Select-Object -First 1 }',
    '      if ($application) { $logo = $application.VisualElements.Square44x44Logo }',
    '      if (-not $logo) { $logo = $manifest.Package.Properties.Logo }',
    '    }',
    '  } catch {}',
    '  if ($logo) { $icons[$package.PackageFamilyName] = Join-Path $package.InstallLocation $logo }',
    '}',
    '$startApps | ForEach-Object {',
    '  $family = $_.AppID.Split("!")[0]',
    '  [pscustomobject]@{ Name = $_.Name; AppID = $_.AppID; IconPath = $icons[$family] }',
    '} | ConvertTo-Json -Compress'
  ].join('\n')
  const { stdout } = await runFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      timeout: APP_SCAN_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024
    }
  )
  return stdout
}

function sortApps(apps: ScannedApp[]): ScannedApp[] {
  return apps.sort(
    (left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
      left.id.localeCompare(right.id)
  )
}

export class AppScanner {
  private readonly roots: readonly string[]
  private readonly iconsDir: string
  private readonly readShortcut: (path: string) => ShortcutLink
  private readonly getFileIcon: (path: string) => Promise<NativeImageLike>
  private readonly createImage: ((path: string) => NativeImageLike) | undefined
  private readonly listStartApps: () => Promise<string>
  private readonly steamRoots: () => Promise<readonly string[]>
  private readonly debounceMs: number
  private readonly listeners = new Set<(apps: AppEntry[]) => void>()
  private readonly watchers: FSWatcher[] = []
  private apps: ScannedApp[] = []
  private scanPromise: Promise<AppEntry[]> | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private scanning = false
  private lastScanAt: string | null = null

  constructor(options: AppScannerOptions) {
    this.roots = options.roots
    this.iconsDir = options.iconsDir
    this.readShortcut = options.readShortcut
    this.getFileIcon = options.getFileIcon
    this.createImage = options.createImage
    this.listStartApps = options.listStartApps ?? defaultListStartApps
    this.steamRoots = options.steamRoots ?? (async () => [])
    this.debounceMs = options.debounceMs ?? APP_SCAN_DEBOUNCE_MS
  }

  list(): AppEntry[] {
    return this.apps.map((app) => this.toPublic(app))
  }

  isScanning(): boolean {
    return this.scanning
  }

  lastScanTime(): string | null {
    return this.lastScanAt
  }

  scanned(): ScannedApp[] {
    return this.apps.map((app) => ({ ...app }))
  }

  onChange(listener: (apps: AppEntry[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  startWatching(): void {
    if (this.watchers.length > 0) {
      return
    }
    for (const root of this.roots) {
      try {
        const watcher = watch(root, { recursive: true }, () => this.scheduleScan())
        watcher.on('error', () => undefined)
        this.watchers.push(watcher)
      } catch {
        // A missing Start Menu folder is normal on some installations.
      }
    }
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    for (const watcher of this.watchers.splice(0)) {
      watcher.close()
    }
  }

  async refresh(): Promise<AppEntry[]> {
    if (this.scanPromise) {
      return this.scanPromise
    }

    this.scanning = true
    this.scanPromise = this.scan()
      .then((apps) => {
        this.apps = apps
        this.lastScanAt = new Date().toISOString()
        const list = this.list()
        for (const listener of this.listeners) {
          listener(list)
        }
        return list
      })
      .finally(() => {
        this.scanPromise = null
        this.scanning = false
      })

    return this.scanPromise
  }

  private scheduleScan(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.refresh().catch(() => undefined)
    }, this.debounceMs)
  }

  private async scan(): Promise<ScannedApp[]> {
    const [classic, startApps, steam] = await Promise.all([
      scanClassicShortcuts({
        roots: this.roots,
        readShortcut: this.readShortcut
      }),
      this.listStartApps()
        .then((raw) => parseStartApps(JSON.parse(raw)))
        .catch(() => [] as ScannedApp[]),
      this.steamRoots()
        .then((roots) => scanSteamLibraries(roots))
        .catch(() => [] as ScannedApp[])
    ])

    const classicNames = new Set(
      classic.filter((app) => !app.hidden).map((app) => app.name.toLowerCase())
    )
    const steamNames = new Set(steam.map((app) => app.name.toLowerCase()))
    const startOnly = startApps.filter(
      (app) => !classicNames.has(app.name.toLowerCase()) && !steamNames.has(app.name.toLowerCase())
    )

    await this.updateIcons([...classic, ...startOnly, ...steam])
    return sortApps([...classic, ...steam, ...startOnly])
  }

  private async updateIcons(apps: ScannedApp[]): Promise<void> {
    await mkdir(this.iconsDir, { recursive: true }).catch(() => undefined)

    for (const app of apps) {
      if (!APP_ICON_ID_RE.test(app.id)) {
        app.iconUrl = null
        continue
      }

      const hasIcon =
        app.kind === 'uwp'
          ? await this.cacheUwpIcon(app)
          : app.kind === 'steam'
            ? await this.cacheSteamIcon(app)
            : await this.cacheClassicIcon(app)
      app.iconUrl = hasIcon ? iconUrlForId(app.id) : null
    }
  }

  private async cacheIcon(
    app: ScannedApp,
    source: string,
    load: () => Promise<Buffer>
  ): Promise<boolean> {
    const metaPath = join(this.iconsDir, `${app.id}.json`)
    const iconPath = join(this.iconsDir, `${app.id}.png`)
    try {
      const info = await stat(source)
      const meta = await readFile(metaPath, 'utf8')
        .then((raw) => JSON.parse(raw) as { mtimeMs?: unknown; source?: unknown })
        .catch(() => null)
      if (
        meta &&
        meta.mtimeMs === info.mtimeMs &&
        meta.source === source &&
        Boolean(await stat(iconPath).catch(() => null))
      ) {
        app.mtimeMs = info.mtimeMs
        return true
      }

      const png = await load()
      if (png.length === 0) {
        throw new Error('empty icon')
      }
      await writeFile(iconPath, png)
      await writeFile(metaPath, JSON.stringify({ mtimeMs: info.mtimeMs, source }), 'utf8')
      app.mtimeMs = info.mtimeMs
      return true
    } catch {
      await rm(iconPath, { force: true }).catch(() => undefined)
      await rm(metaPath, { force: true }).catch(() => undefined)
      return false
    }
  }

  private async cacheClassicIcon(app: ScannedApp): Promise<boolean> {
    const sources = new Set<string>()
    if (app.iconPath) sources.add(app.iconPath)
    if (app.iconFallbackPath) sources.add(expandEnvPath(app.iconFallbackPath))
    for (const source of sources) {
      if (!source) continue
      const hasIcon = await this.cacheIcon(app, source, async () => {
        const image = await this.getFileIcon(source)
        return image.toPNG()
      })
      if (hasIcon) return true
    }
    return false
  }

  private async cacheUwpIcon(app: ScannedApp): Promise<boolean> {
    if (!app.iconPath) return false
    const source = await resolveUwpIconFile(app.iconPath)
    if (!source) return false
    return this.cacheIcon(app, source, async () => {
      const raw = await readFile(source)
      if (isPng(raw)) return raw
      const image = this.createImage?.(source)
      return image?.toPNG() ?? Buffer.alloc(0)
    })
  }

  private async cacheSteamIcon(app: ScannedApp): Promise<boolean> {
    if (!app.iconPath || !this.createImage) return false
    const source = await this.findSteamIcon(app.iconPath)
    if (!source) return false
    return this.cacheIcon(app, source, async () => {
      const image = this.createImage?.(source)
      if (!image || image.isEmpty?.()) return Buffer.alloc(0)
      return image.toPNG()
    })
  }

  private async findSteamIcon(directory: string): Promise<string | null> {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    let fallback: string | null = null
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(png|jpe?g)$/i.test(entry.name)) continue
      const candidate = join(directory, entry.name)
      const image = this.createImage?.(candidate)
      if (!image || image.isEmpty?.()) continue
      const size = image.getSize?.()
      if (!size || size.width !== size.height) continue
      if (size.width === 32) return candidate
      if (size.width >= 32 && size.width <= 128 && !fallback) {
        fallback = candidate
      }
    }
    return fallback
  }

  private toPublic(app: ScannedApp): AppEntry {
    return {
      id: app.id,
      name: app.name,
      kind: app.kind,
      hidden: app.hidden,
      iconUrl: app.iconUrl
    }
  }
}
