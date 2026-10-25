import { randomUUID } from 'node:crypto'
import { access, copyFile, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { WIDGET_ID_RE } from '../../shared/constants'
import { findBuiltin } from '../../shared/builtins'
import { widgetManifestSchema, widgetPlacementSchema } from '../../shared/schemas'
import type {
  BuiltinWidget,
  LayoutFile,
  WidgetManifest,
  WidgetPlacement,
  WidgetSummary
} from '../../shared/types'
import type { NoticeService } from './notices'
import { JsonStore, writeAtomicJson } from './store'

export interface WidgetServiceOptions {
  widgetsDir: string
  builtinsDir: string
  layout: JsonStore<LayoutFile>
  notices?: NoticeService
  now?: () => string
  createId?: () => string
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })
  for (const entry of entries) {
    const from = join(source, entry.name)
    const to = join(target, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(from, to)
    } else if (entry.isFile()) {
      await copyFile(from, to)
    }
  }
}

function duplicateName(name: string): string {
  const suffix = ' copy'
  if (name.length + suffix.length <= 40) {
    return name + suffix
  }
  return name.slice(0, 40 - suffix.length) + suffix
}

export class WidgetService {
  readonly widgetsDir: string
  private readonly builtinsDir: string
  private readonly layout: JsonStore<LayoutFile>
  private readonly notices: NoticeService | null
  private readonly now: () => string
  private readonly createId: () => string
  private readonly manifests = new Map<string, WidgetManifest>()

  constructor(options: WidgetServiceOptions) {
    this.widgetsDir = options.widgetsDir
    this.builtinsDir = options.builtinsDir
    this.layout = options.layout
    this.notices = options.notices ?? null
    this.now = options.now ?? (() => new Date().toISOString())
    this.createId = options.createId ?? (() => randomUUID())
  }

  async load(): Promise<void> {
    await this.layout.load()
    await this.syncManifests()
  }

  get layoutWasMissing(): boolean {
    return !this.layout.hadFile
  }

  get layoutRecovered(): boolean {
    return this.layout.recovered
  }

  listPlacements(): WidgetPlacement[] {
    return this.layout.get().placements.map((placement) => ({ ...placement }))
  }

  getPlacement(widgetId: string): WidgetPlacement | null {
    const placement = this.layout.get().placements.find((item) => item.widgetId === widgetId)
    return placement ? { ...placement } : null
  }

  listSummaries(): WidgetSummary[] {
    const summaries: WidgetSummary[] = []
    for (const placement of this.layout.get().placements) {
      const manifest = this.manifests.get(placement.widgetId)
      if (manifest) {
        summaries.push({ manifest, placement: { ...placement } })
      }
    }
    return summaries
  }

  getManifest(widgetId: string): WidgetManifest | null {
    return this.manifests.get(widgetId) ?? null
  }

  listManifests(): WidgetManifest[] {
    return [...this.manifests.values()]
  }

  nextZOrder(): number {
    return (
      this.layout.get().placements.reduce((max, placement) => {
        return Math.max(max, placement.zOrder)
      }, 0) + 1
    )
  }

  async create(
    builtin: BuiltinWidget,
    placement: Omit<WidgetPlacement, 'widgetId'>
  ): Promise<WidgetSummary> {
    const widgetId = this.createId()
    if (!WIDGET_ID_RE.test(widgetId)) {
      throw new Error(`Generated widget id is invalid: ${widgetId}`)
    }

    const manifest = await this.installBuiltin(builtin, widgetId, builtin.name)
    const fullPlacement = this.addPlacement({ ...placement, widgetId })
    return { manifest, placement: fullPlacement }
  }

  async duplicate(
    widgetId: string,
    placement: Omit<WidgetPlacement, 'widgetId'>
  ): Promise<WidgetSummary> {
    const source = this.requireManifest(widgetId)
    const newId = this.createId()
    if (!WIDGET_ID_RE.test(newId)) {
      throw new Error(`Generated widget id is invalid: ${newId}`)
    }

    const now = this.now()
    const manifest: WidgetManifest = {
      ...source,
      id: newId,
      name: duplicateName(source.name),
      createdAt: now,
      updatedAt: now
    }

    await this.copyWidget(widgetId, newId, manifest)
    const fullPlacement = this.addPlacement({ ...placement, widgetId: newId })
    return { manifest, placement: fullPlacement }
  }

  async ensureBuiltin(type: string): Promise<WidgetManifest> {
    const existing = this.manifests.get(type)
    if (existing) {
      return existing
    }

    const builtin = findBuiltin(type)
    if (!builtin) {
      throw new Error(`Unknown built-in widget: ${type}`)
    }

    const target = join(this.widgetsDir, type)
    if (await pathExists(join(target, 'index.html'))) {
      const manifest = await this.migrateLegacy(type)
      if (manifest) {
        return manifest
      }
    }

    if (await pathExists(target)) {
      const backup = `${target}.broken-${Date.now()}`
      await rename(target, backup)
    }

    return this.installBuiltin(builtin, type, builtin.name)
  }

  addPlacement(placement: WidgetPlacement): WidgetPlacement {
    const parsed = widgetPlacementSchema.parse(placement)
    this.layout.update((data) => {
      data.placements.push(parsed)
    })
    return parsed
  }

  updatePlacement(
    widgetId: string,
    patch: Partial<Omit<WidgetPlacement, 'widgetId'>>
  ): WidgetPlacement | null {
    const current = this.getPlacement(widgetId)
    if (!current) {
      return null
    }

    const next = widgetPlacementSchema.parse({ ...current, ...patch, widgetId })
    this.layout.update((data) => {
      const index = data.placements.findIndex((item) => item.widgetId === widgetId)
      if (index >= 0) {
        data.placements[index] = next
      }
    })
    return next
  }

  removePlacement(widgetId: string): boolean {
    let removed = false
    this.layout.update((data) => {
      const next = data.placements.filter((placement) => placement.widgetId !== widgetId)
      removed = next.length !== data.placements.length
      data.placements = next
    })
    return removed
  }

  async remove(widgetId: string, deleteFiles: boolean): Promise<boolean> {
    const removed = this.removePlacement(widgetId)
    if (deleteFiles) {
      await rm(join(this.widgetsDir, widgetId), { recursive: true, force: true })
      this.manifests.delete(widgetId)
    }
    return removed
  }

  async flush(): Promise<void> {
    await this.layout.close()
  }

  private requireManifest(widgetId: string): WidgetManifest {
    const manifest = this.manifests.get(widgetId)
    if (!manifest) {
      throw new Error(`Widget not found: ${widgetId}`)
    }
    return manifest
  }

  private async syncManifests(): Promise<void> {
    await mkdir(this.widgetsDir, { recursive: true })
    const entries = await readdir(this.widgetsDir, { withFileTypes: true })
    const seen = new Set<string>()

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || !WIDGET_ID_RE.test(entry.name)) {
        continue
      }
      const id = entry.name
      seen.add(id)
      if (this.manifests.has(id)) {
        continue
      }
      const manifest = await this.readManifest(id)
      if (manifest) {
        this.manifests.set(id, manifest)
      }
    }

    for (const id of this.manifests.keys()) {
      if (!seen.has(id)) {
        this.manifests.delete(id)
      }
    }
  }

  private async readManifest(widgetId: string): Promise<WidgetManifest | null> {
    const directory = join(this.widgetsDir, widgetId)
    const manifestPath = join(directory, 'manifest.json')

    try {
      const raw = await readFile(manifestPath, 'utf8')
      const manifest = widgetManifestSchema.parse(JSON.parse(raw))
      if (manifest.id !== widgetId) {
        throw new Error(`Manifest id ${manifest.id} does not match folder ${widgetId}`)
      }
      return manifest
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return this.migrateLegacy(widgetId)
      }
      if (code) {
        throw error
      }

      const backup = `${manifestPath}.corrupt-${Date.now()}`
      await rename(manifestPath, backup).catch(() => undefined)
      this.notices?.add(
        'warning',
        `Widget "${widgetId}" has an invalid manifest. A backup was saved and the widget was skipped.`
      )
      return null
    }
  }

  private async migrateLegacy(widgetId: string): Promise<WidgetManifest | null> {
    const builtin = findBuiltin(widgetId)
    if (!builtin) {
      return null
    }

    const directory = join(this.widgetsDir, widgetId)
    if (!(await pathExists(join(directory, 'index.html')))) {
      return null
    }

    const manifest = this.buildManifest(widgetId, builtin.name, builtin)
    await writeAtomicJson(join(directory, 'manifest.json'), manifest)
    this.manifests.set(widgetId, manifest)
    return manifest
  }

  private async installBuiltin(
    builtin: BuiltinWidget,
    widgetId: string,
    name: string
  ): Promise<WidgetManifest> {
    const source = join(this.builtinsDir, builtin.type)
    await access(join(source, 'index.html'))

    await mkdir(this.widgetsDir, { recursive: true })
    const target = join(this.widgetsDir, widgetId)
    const temporary = join(this.widgetsDir, `.${widgetId}.tmp-${process.pid}-${Date.now()}`)
    await rm(temporary, { recursive: true, force: true })

    const manifest = this.buildManifest(widgetId, name, builtin)
    try {
      await copyDirectory(source, temporary)
      await writeAtomicJson(join(temporary, 'manifest.json'), manifest)
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, { recursive: true, force: true })
      throw error
    }

    this.manifests.set(widgetId, manifest)
    return manifest
  }

  private async copyWidget(
    sourceId: string,
    targetId: string,
    manifest: WidgetManifest
  ): Promise<void> {
    const source = join(this.widgetsDir, sourceId)
    const target = join(this.widgetsDir, targetId)
    const temporary = join(this.widgetsDir, `.${targetId}.tmp-${process.pid}-${Date.now()}`)
    await rm(temporary, { recursive: true, force: true })

    try {
      await copyDirectory(source, temporary)
      await writeAtomicJson(join(temporary, 'manifest.json'), manifest)
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, { recursive: true, force: true })
      throw asError(error)
    }

    this.manifests.set(targetId, manifest)
  }

  private buildManifest(widgetId: string, name: string, builtin: BuiltinWidget): WidgetManifest {
    const now = this.now()
    return {
      schema: 1,
      id: widgetId,
      name,
      kind: 'builtin',
      builtinType: builtin.type,
      width: builtin.width,
      height: builtin.height,
      minWidth: builtin.minWidth,
      minHeight: builtin.minHeight,
      permissions: [],
      grantedPermissions: [],
      allowedHosts: [],
      createdAt: now,
      updatedAt: now
    }
  }
}
