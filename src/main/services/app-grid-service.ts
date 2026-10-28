import { randomUUID } from 'node:crypto'
import { BUNDLE_NAME_MAX, GRID_TITLE_MAX } from '../../shared/constants'
import type {
  AppBundleRecord,
  AppBundleSummary,
  AppGridFile,
  AppGridItemRef,
  AppGridState,
  AppGroupsFile,
  BundlePopoverResult,
  BundlePopoverState
} from '../../shared/types'
import type { AppScanner } from './app-scanner'
import {
  addApps,
  itemKey,
  mergeApp,
  moveItem,
  removeApp,
  removeFromBundle,
  renameBundle,
  reorderBundleApps,
  resolveGridState
} from './app-grid-model'
import type { JsonStore } from './store'

export interface AppGridServiceOptions {
  grids: JsonStore<AppGridFile>
  groups: JsonStore<AppGroupsFile>
  scanner: Pick<AppScanner, 'list'>
  createId?: () => string
}

function cloneItems(items: readonly AppGridItemRef[]): AppGridItemRef[] {
  return items.map((item) => ({ ...item }))
}

function cloneBundles(bundles: readonly AppBundleRecord[]): AppBundleRecord[] {
  return bundles.map((bundle) => ({ ...bundle, appIds: [...bundle.appIds] }))
}

export class AppGridService {
  private readonly grids: JsonStore<AppGridFile>
  private readonly groups: JsonStore<AppGroupsFile>
  private readonly scanner: Pick<AppScanner, 'list'>
  private readonly createId: () => string

  constructor(options: AppGridServiceOptions) {
    this.grids = options.grids
    this.groups = options.groups
    this.scanner = options.scanner
    this.createId = options.createId ?? (() => randomUUID())
  }

  async load(): Promise<void> {
    await Promise.all([this.grids.load(), this.groups.load()])
  }

  gridTitle(widgetId: string): string {
    const title = this.grids.get().grids[widgetId]?.title
    return typeof title === 'string' && title.trim() ? title.trim() : 'Apps'
  }

  state(widgetId: string): AppGridState {
    const title = this.grids.get().grids[widgetId]?.title
    return resolveGridState(
      widgetId,
      this.items(widgetId),
      this.bundles(),
      this.scanner.list(),
      title
    )
  }

  listBundles(): AppBundleSummary[] {
    const apps = new Map(this.scanner.list().map((app) => [app.id, app]))
    const gridTitles = this.grids.get().grids
    return this.bundles()
      .map((bundle) => ({
        id: bundle.id,
        gridId: bundle.gridId,
        gridTitle: gridTitles[bundle.gridId]?.title ?? 'Apps',
        name: bundle.name,
        apps: bundle.appIds
          .map((appId) => apps.get(appId))
          .filter((app): app is NonNullable<typeof app> => app !== undefined)
      }))
      .sort(
        (left, right) =>
          left.gridTitle.localeCompare(right.gridTitle) || left.name.localeCompare(right.name)
      )
  }

  bundleState(widgetId: string, bundleId: string): BundlePopoverState | null {
    const bundle = this.bundles().find(
      (candidate) => candidate.id === bundleId && candidate.gridId === widgetId
    )
    if (!bundle) {
      return null
    }
    const state = this.state(widgetId)
    const view = state.items.find((item) => item.type === 'bundle' && item.bundle.id === bundleId)
    return view && view.type === 'bundle' ? { bundle: view.bundle } : null
  }

  addApps(widgetId: string, appIds: readonly string[]): AppGridState {
    const known = new Set(this.scanner.list().map((app) => app.id))
    const requested = appIds.filter((appId) => known.has(appId))
    if (requested.length === 0) {
      return this.state(widgetId)
    }

    const result = addApps(this.items(widgetId), this.bundles(), requested)
    if (result.added.length === 0) {
      return this.state(widgetId)
    }
    this.setItems(widgetId, result.items)
    return this.state(widgetId)
  }

  removeApp(widgetId: string, appId: string): AppGridState {
    const result = removeApp(this.items(widgetId), this.bundles(), appId)
    this.setItems(widgetId, result.items)
    this.setBundles(result.bundles)
    return this.state(widgetId)
  }

  move(widgetId: string, from: number, to: number): AppGridState {
    const next = moveItem(this.items(widgetId), from, to)
    this.setItems(widgetId, next)
    return this.state(widgetId)
  }

  merge(widgetId: string, sourceAppId: string, targetKey: string): AppGridState {
    const result = mergeApp(
      this.items(widgetId),
      this.bundles(),
      widgetId,
      sourceAppId,
      targetKey,
      this.createId
    )
    if (!result.bundleId) {
      return this.state(widgetId)
    }
    this.setItems(widgetId, result.items)
    this.setBundles(result.bundles)
    return this.state(widgetId)
  }

  renameTitle(widgetId: string, rawTitle: string): AppGridState {
    const title = rawTitle.trim().slice(0, GRID_TITLE_MAX)
    if (!title) {
      return this.state(widgetId)
    }
    this.grids.update((data) => {
      data.grids[widgetId] = {
        ...data.grids[widgetId],
        items: cloneItems(data.grids[widgetId]?.items ?? []),
        title
      }
    })
    return this.state(widgetId)
  }

  renameBundle(widgetId: string, bundleId: string, rawName: string): AppGridState {
    const name = rawName.trim().slice(0, BUNDLE_NAME_MAX)
    if (!name || !this.hasBundle(widgetId, bundleId)) {
      return this.state(widgetId)
    }
    this.setBundles(renameBundle(this.bundles(), bundleId, name))
    return this.state(widgetId)
  }

  removeAppFromBundle(widgetId: string, bundleId: string, appId: string): BundlePopoverResult {
    if (!this.hasBundle(widgetId, bundleId)) {
      return { state: null, dissolved: false }
    }
    const result = removeFromBundle(this.items(widgetId), this.bundles(), bundleId, appId)
    if (!result.removed) {
      return { state: this.bundleState(widgetId, bundleId), dissolved: false }
    }
    this.setItems(widgetId, result.items)
    this.setBundles(result.bundles)
    return {
      state: result.dissolved ? null : this.bundleState(widgetId, bundleId),
      dissolved: result.dissolved
    }
  }

  reorderBundle(widgetId: string, bundleId: string, from: number, to: number): BundlePopoverResult {
    if (!this.hasBundle(widgetId, bundleId)) {
      return { state: null, dissolved: false }
    }
    this.setBundles(reorderBundleApps(this.bundles(), bundleId, from, to))
    return { state: this.bundleState(widgetId, bundleId), dissolved: false }
  }

  createBundle(
    widgetId: string,
    name: string,
    appIds: readonly string[]
  ): { bundleId: string; state: AppGridState } {
    const known = new Set(this.scanner.list().map((app) => app.id))
    const validAppIds = appIds.filter((id) => known.has(id))
    const bundleName = name.trim().slice(0, BUNDLE_NAME_MAX) || 'Bundle'
    const bundleId = this.createId()
    const bundle: AppBundleRecord = {
      id: bundleId,
      gridId: widgetId,
      name: bundleName,
      appIds: validAppIds
    }
    const currentItems = this.items(widgetId)
    const nextItems: AppGridItemRef[] = currentItems.filter(
      (item) => !(item.type === 'app' && validAppIds.includes(item.appId))
    )
    nextItems.push({ type: 'bundle', bundleId })
    this.setItems(widgetId, nextItems)
    this.setBundles([...this.bundles(), bundle])
    return { bundleId, state: this.state(widgetId) }
  }

  deleteBundle(bundleId: string): void {
    const currentBundles = this.bundles()
    const bundle = currentBundles.find((candidate) => candidate.id === bundleId)
    if (!bundle) {
      return
    }
    this.setBundles(currentBundles.filter((candidate) => candidate.id !== bundleId))
    const gridsData = this.grids.get().grids
    for (const gridId of Object.keys(gridsData)) {
      const items = this.items(gridId)
      if (items.some((item) => item.type === 'bundle' && item.bundleId === bundleId)) {
        this.setItems(
          gridId,
          items.filter((item) => !(item.type === 'bundle' && item.bundleId === bundleId))
        )
      }
    }
  }

  addBundleToGrid(widgetId: string, bundleId: string): AppGridState {
    const bundle = this.bundles().find((candidate) => candidate.id === bundleId)
    if (!bundle) {
      return this.state(widgetId)
    }
    if (bundle.gridId !== widgetId) {
      this.setBundles(
        this.bundles().map((b) => (b.id === bundleId ? { ...b, gridId: widgetId } : b))
      )
    }
    const currentItems = this.items(widgetId)
    if (!currentItems.some((item) => item.type === 'bundle' && item.bundleId === bundleId)) {
      this.setItems(widgetId, [...currentItems, { type: 'bundle', bundleId }])
    }
    return this.state(widgetId)
  }

  removeBundle(widgetId: string, bundleId: string): AppGridState {
    const currentItems = this.items(widgetId)
    this.setItems(
      widgetId,
      currentItems.filter((item) => !(item.type === 'bundle' && item.bundleId === bundleId))
    )
    return this.state(widgetId)
  }

  appIdsInBundle(widgetId: string, bundleId: string): string[] {
    const bundle = this.bundles().find(
      (candidate) => candidate.id === bundleId && candidate.gridId === widgetId
    )
    return bundle ? [...bundle.appIds] : []
  }

  async flush(): Promise<void> {
    await Promise.all([this.grids.close(), this.groups.close()])
  }

  private items(widgetId: string): AppGridItemRef[] {
    return cloneItems(this.grids.get().grids[widgetId]?.items ?? [])
  }

  private bundles(): AppBundleRecord[] {
    return cloneBundles(this.groups.get().bundles)
  }

  private setItems(widgetId: string, items: readonly AppGridItemRef[]): void {
    this.grids.update((data) => {
      data.grids[widgetId] = {
        ...data.grids[widgetId],
        items: cloneItems(items)
      }
    })
  }

  private setBundles(bundles: readonly AppBundleRecord[]): void {
    this.groups.update((data) => {
      data.bundles = cloneBundles(bundles)
    })
  }

  private hasBundle(widgetId: string, bundleId: string): boolean {
    return this.bundles().some((bundle) => bundle.id === bundleId && bundle.gridId === widgetId)
  }

  targetKeyForApp(appId: string): string {
    return itemKey({ type: 'app', appId })
  }
}
