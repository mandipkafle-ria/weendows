import { randomUUID } from 'node:crypto'
import { access, copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AI_HISTORY_LIMIT, AI_PREVIEW_PREFIX, WIDGET_ID_RE } from '../../shared/constants'
import { findBuiltin, findBuiltinVariant } from '../../shared/builtins'
import { widgetManifestSchema, widgetPlacementSchema } from '../../shared/schemas'
import { minimumSizeFor } from '../../shared/widget-size'
import type {
  AiApproval,
  AiManifest,
  BuiltinWidget,
  LayoutFile,
  WidgetManifest,
  WidgetPermission,
  WidgetPlacement,
  WidgetSummary
} from '../../shared/types'
import type { NoticeService } from './notices'
import { JsonStore, writeAtomicJson } from './store'
import { withPermission } from './widget-permissions'

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

async function writeFileAtomic(path: string, data: string): Promise<void> {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`
  await writeFile(temporary, data, 'utf8')
  await rename(temporary, path)
}

function approvedPermissions(manifest: AiManifest, approval: AiApproval): WidgetPermission[] {
  return approval.permissions.filter((permission) => manifest.permissions.includes(permission))
}

function approvedHosts(manifest: AiManifest, approval: AiApproval): string[] {
  if (!manifest.permissions.includes('network') || !approval.permissions.includes('network')) {
    return []
  }
  return approval.allowedHosts.filter((host) => manifest.allowedHosts.includes(host))
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
    await this.cleanupPreviews()
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

  getSummary(widgetId: string): WidgetSummary | null {
    const manifest = this.manifests.get(widgetId)
    const placement = this.getPlacement(widgetId)
    if (!manifest || !placement) {
      return null
    }
    return { manifest, placement }
  }

  listManifests(): WidgetManifest[] {
    return [...this.manifests.values()]
  }

  listSavedAiWidgets(): WidgetManifest[] {
    const placed = new Set(this.layout.get().placements.map((placement) => placement.widgetId))
    return [...this.manifests.values()]
      .filter(
        (manifest) =>
          manifest.kind === 'ai' &&
          !manifest.id.startsWith(AI_PREVIEW_PREFIX) &&
          !placed.has(manifest.id)
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
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
    placement: Omit<WidgetPlacement, 'widgetId'>,
    variantId?: string
  ): Promise<WidgetSummary> {
    const widgetId = this.createId()
    if (!WIDGET_ID_RE.test(widgetId)) {
      throw new Error(`Generated widget id is invalid: ${widgetId}`)
    }

    const manifest = await this.installBuiltin(builtin, widgetId, builtin.name, variantId)
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

  async cleanupPreviews(): Promise<void> {
    await mkdir(this.widgetsDir, { recursive: true })
    const entries = await readdir(this.widgetsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(AI_PREVIEW_PREFIX)) {
        await rm(join(this.widgetsDir, entry.name), { recursive: true, force: true })
        this.manifests.delete(entry.name)
      }
    }
  }

  async createPreview(
    aiManifest: AiManifest,
    html: string,
    prompt: string
  ): Promise<WidgetManifest> {
    const widgetId = `${AI_PREVIEW_PREFIX}${this.createId()}`
    if (!WIDGET_ID_RE.test(widgetId)) {
      throw new Error(`Generated preview id is invalid: ${widgetId}`)
    }

    const now = this.now()
    const manifest: WidgetManifest = {
      schema: 1,
      id: widgetId,
      name: aiManifest.name,
      kind: 'ai',
      width: aiManifest.width,
      height: aiManifest.height,
      ...minimumSizeFor(aiManifest.width, aiManifest.height, aiManifest),
      focusable: false,
      permissions: [...aiManifest.permissions],
      grantedPermissions: [...aiManifest.permissions],
      allowedHosts: [...aiManifest.allowedHosts],
      prompt,
      createdAt: now,
      updatedAt: now
    }

    await this.writeNewWidgetDirectory(widgetId, manifest, html)
    this.manifests.set(widgetId, manifest)
    return manifest
  }

  async removePreview(widgetId: string): Promise<void> {
    if (!widgetId.startsWith(AI_PREVIEW_PREFIX)) {
      return
    }
    await rm(join(this.widgetsDir, widgetId), { recursive: true, force: true })
    this.manifests.delete(widgetId)
  }

  async createAiWidget(
    aiManifest: AiManifest,
    html: string,
    placement: Omit<WidgetPlacement, 'widgetId'>,
    prompt: string,
    approval: AiApproval
  ): Promise<WidgetSummary> {
    const widgetId = this.createId()
    if (!WIDGET_ID_RE.test(widgetId)) {
      throw new Error(`Generated widget id is invalid: ${widgetId}`)
    }

    const now = this.now()
    const manifest: WidgetManifest = {
      schema: 1,
      id: widgetId,
      name: aiManifest.name,
      kind: 'ai',
      width: aiManifest.width,
      height: aiManifest.height,
      ...minimumSizeFor(aiManifest.width, aiManifest.height, aiManifest),
      focusable: false,
      permissions: [...aiManifest.permissions],
      grantedPermissions: approvedPermissions(aiManifest, approval),
      allowedHosts: approvedHosts(aiManifest, approval),
      prompt,
      createdAt: now,
      updatedAt: now
    }

    await this.writeNewWidgetDirectory(widgetId, manifest, html)
    this.manifests.set(widgetId, manifest)

    try {
      const fullPlacement = this.addPlacement({ ...placement, widgetId })
      return { manifest, placement: fullPlacement }
    } catch (error) {
      this.manifests.delete(widgetId)
      await rm(join(this.widgetsDir, widgetId), { recursive: true, force: true })
      throw asError(error)
    }
  }

  async updateWidgetFromAi(
    widgetId: string,
    aiManifest: AiManifest,
    html: string,
    approval: AiApproval
  ): Promise<WidgetManifest> {
    const current = this.requireManifest(widgetId)
    await this.pushHistory(widgetId)

    const next = widgetManifestSchema.parse({
      ...current,
      name: aiManifest.name,
      width: aiManifest.width,
      height: aiManifest.height,
      ...minimumSizeFor(aiManifest.width, aiManifest.height, aiManifest),
      permissions: [...aiManifest.permissions],
      grantedPermissions: approvedPermissions(aiManifest, approval),
      allowedHosts: approvedHosts(aiManifest, approval),
      updatedAt: this.now()
    })

    await writeFileAtomic(join(this.widgetsDir, widgetId, 'index.html'), html)
    await writeAtomicJson(join(this.widgetsDir, widgetId, 'manifest.json'), next)
    this.manifests.set(widgetId, next)
    this.enforceMinimumPlacement(next)
    return next
  }

  async readWidgetSource(widgetId: string): Promise<{ manifest: WidgetManifest; html: string }> {
    const manifest = this.requireManifest(widgetId)
    const html = await readFile(join(this.widgetsDir, widgetId, 'index.html'), 'utf8')
    return { manifest, html }
  }

  async pushHistory(widgetId: string): Promise<void> {
    const directory = join(this.widgetsDir, widgetId)
    const [manifestRaw, html] = await Promise.all([
      readFile(join(directory, 'manifest.json'), 'utf8'),
      readFile(join(directory, 'index.html'), 'utf8')
    ])
    const historyDir = join(directory, 'history')
    const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
    const target = join(historyDir, stamp)
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'manifest.json'), manifestRaw, 'utf8')
    await writeFile(join(target, 'index.html'), html, 'utf8')
    await this.pruneHistory(widgetId)
  }

  async historyCount(widgetId: string): Promise<number> {
    const historyDir = join(this.widgetsDir, widgetId, 'history')
    try {
      const entries = await readdir(historyDir, { withFileTypes: true })
      return entries.filter((entry) => entry.isDirectory()).length
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return 0
      }
      throw asError(error)
    }
  }

  async undoWidget(widgetId: string): Promise<WidgetManifest> {
    const historyDir = join(this.widgetsDir, widgetId, 'history')
    const entries = (await readdir(historyDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    const latest = entries[entries.length - 1]
    if (!latest) {
      throw new Error('There is no earlier version to restore.')
    }

    const source = join(historyDir, latest)
    const manifest = widgetManifestSchema.parse(
      JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'))
    )
    if (manifest.id !== widgetId) {
      throw new Error('The saved version does not match this widget.')
    }
    const html = await readFile(join(source, 'index.html'), 'utf8')

    await writeFileAtomic(join(this.widgetsDir, widgetId, 'index.html'), html)
    await writeAtomicJson(join(this.widgetsDir, widgetId, 'manifest.json'), manifest)
    await rm(source, { recursive: true, force: true })
    this.manifests.set(widgetId, manifest)
    return manifest
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

  async setBuiltinVariant(widgetId: string, variantId: string): Promise<WidgetManifest> {
    const manifest = this.requireManifest(widgetId)
    if (manifest.kind !== 'builtin' || !manifest.builtinType) {
      throw new Error('Only built-in widgets can change design.')
    }
    const builtin = findBuiltin(manifest.builtinType)
    if (!builtin) {
      throw new Error(`Unknown built-in widget: ${manifest.builtinType}`)
    }
    const variant = builtin.variants.find((item) => item.id === variantId)
    if (!variant) {
      throw new Error(`Unknown design: ${variantId}`)
    }

    const next = await this.updateManifest(widgetId, {
      variant: variant.id,
      width: variant.width,
      height: variant.height,
      minWidth: variant.minWidth,
      minHeight: variant.minHeight
    })
    this.enforceMinimumPlacement(next)
    return next
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

  async remove(widgetId: string): Promise<boolean> {
    return this.removePlacement(widgetId)
  }

  clearPlacements(): void {
    this.layout.update((data) => {
      data.placements = []
    })
  }

  async delete(widgetId: string): Promise<boolean> {
    if (!this.manifests.has(widgetId)) {
      return false
    }
    await rm(join(this.widgetsDir, widgetId), { recursive: true, force: true })
    this.manifests.delete(widgetId)
    return true
  }

  async updateManifest(
    widgetId: string,
    patch: Partial<Omit<WidgetManifest, 'id' | 'schema' | 'createdAt'>>
  ): Promise<WidgetManifest> {
    const current = this.requireManifest(widgetId)
    const next = widgetManifestSchema.parse({
      ...current,
      ...patch,
      id: widgetId,
      updatedAt: this.now()
    })
    await writeAtomicJson(join(this.widgetsDir, widgetId, 'manifest.json'), next)
    this.manifests.set(widgetId, next)
    return next
  }

  async setGrantedPermission(
    widgetId: string,
    permission: WidgetPermission,
    granted: boolean
  ): Promise<WidgetSummary> {
    const manifest = this.requireManifest(widgetId)
    if (!manifest.permissions.includes(permission)) {
      throw new Error(`Widget did not request permission: ${permission}`)
    }

    const next = withPermission(manifest, permission, granted)
    const updated = await this.updateManifest(widgetId, {
      grantedPermissions: next.grantedPermissions
    })
    const placement = this.getPlacement(widgetId)
    if (!placement) {
      throw new Error(`Widget not found: ${widgetId}`)
    }
    return { manifest: updated, placement }
  }

  async flush(): Promise<void> {
    await this.layout.close()
  }

  private enforceMinimumPlacement(manifest: WidgetManifest): void {
    const placement = this.getPlacement(manifest.id)
    if (!placement) {
      return
    }
    const limits = minimumSizeFor(manifest.width, manifest.height, manifest)
    if (placement.width < limits.minWidth || placement.height < limits.minHeight) {
      this.updatePlacement(manifest.id, {
        width: Math.max(placement.width, limits.minWidth),
        height: Math.max(placement.height, limits.minHeight)
      })
    }
  }

  private async writeNewWidgetDirectory(
    widgetId: string,
    manifest: WidgetManifest,
    html: string
  ): Promise<void> {
    await mkdir(this.widgetsDir, { recursive: true })
    const target = join(this.widgetsDir, widgetId)
    const temporary = join(this.widgetsDir, `.${widgetId}.tmp-${process.pid}-${Date.now()}`)
    await rm(temporary, { recursive: true, force: true })

    try {
      await mkdir(temporary, { recursive: true })
      await writeFile(join(temporary, 'index.html'), html, 'utf8')
      await writeAtomicJson(join(temporary, 'manifest.json'), manifest)
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, { recursive: true, force: true })
      throw asError(error)
    }
  }

  private async pruneHistory(widgetId: string): Promise<void> {
    const historyDir = join(this.widgetsDir, widgetId, 'history')
    const entries = (await readdir(historyDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    while (entries.length > AI_HISTORY_LIMIT) {
      const oldest = entries.shift()
      if (oldest) {
        await rm(join(historyDir, oldest), { recursive: true, force: true })
      }
    }
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
    name: string,
    variantId?: string
  ): Promise<WidgetManifest> {
    const source = join(this.builtinsDir, builtin.type)
    await access(join(source, 'index.html'))

    await mkdir(this.widgetsDir, { recursive: true })
    const target = join(this.widgetsDir, widgetId)
    const temporary = join(this.widgetsDir, `.${widgetId}.tmp-${process.pid}-${Date.now()}`)
    await rm(temporary, { recursive: true, force: true })

    const manifest = this.buildManifest(widgetId, name, builtin, variantId)
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

  private buildManifest(
    widgetId: string,
    name: string,
    builtin: BuiltinWidget,
    variantId?: string
  ): WidgetManifest {
    const now = this.now()
    const variant = findBuiltinVariant(builtin, variantId)
    return {
      schema: 1,
      id: widgetId,
      name,
      kind: 'builtin',
      builtinType: builtin.type,
      variant: variant.id,
      width: variant.width,
      height: variant.height,
      minWidth: variant.minWidth,
      minHeight: variant.minHeight,
      focusable: builtin.focusable ?? false,
      editPassthrough: builtin.editPassthrough ?? false,
      permissions: [...(builtin.permissions ?? [])],
      grantedPermissions: [...(builtin.permissions ?? [])],
      allowedHosts: [...(builtin.allowedHosts ?? [])],
      createdAt: now,
      updatedAt: now
    }
  }
}
