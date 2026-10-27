import type {
  AppBundleRecord,
  AppBundleView,
  AppEntry,
  AppGridItemRef,
  AppGridItemView,
  AppGridState
} from '../../shared/types'

export interface GridModel {
  items: AppGridItemRef[]
  bundles: AppBundleRecord[]
}

export function itemKey(item: AppGridItemRef): string {
  return item.type === 'app' ? `app:${item.appId}` : `bundle:${item.bundleId}`
}

export function moveItem(
  items: readonly AppGridItemRef[],
  from: number,
  to: number
): AppGridItemRef[] {
  const next = items.map((item) => ({ ...item }))
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return next
  }
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) {
    return next
  }
  const [item] = next.splice(from, 1)
  if (item) {
    next.splice(to, 0, item)
  }
  return next
}

export function moveIds(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids]
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return next
  }
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) {
    return next
  }
  const [id] = next.splice(from, 1)
  if (id) {
    next.splice(to, 0, id)
  }
  return next
}

export function appsOnGrid(
  items: readonly AppGridItemRef[],
  bundles: readonly AppBundleRecord[]
): Set<string> {
  const present = new Set<string>()
  for (const item of items) {
    if (item.type === 'app') {
      present.add(item.appId)
    } else {
      const bundle = bundles.find((candidate) => candidate.id === item.bundleId)
      for (const appId of bundle?.appIds ?? []) {
        present.add(appId)
      }
    }
  }
  return present
}

export function addApps(
  items: readonly AppGridItemRef[],
  bundles: readonly AppBundleRecord[],
  appIds: readonly string[]
): { items: AppGridItemRef[]; added: string[] } {
  const present = appsOnGrid(items, bundles)
  const added: string[] = []
  const next = items.map((item) => ({ ...item }))
  for (const appId of appIds) {
    if (present.has(appId)) {
      continue
    }
    present.add(appId)
    added.push(appId)
    next.push({ type: 'app', appId })
  }
  return { items: next, added }
}

export function removeApp(
  items: readonly AppGridItemRef[],
  bundles: readonly AppBundleRecord[],
  appId: string
): GridModel & { dissolvedBundleIds: string[] } {
  const nextItems: AppGridItemRef[] = []
  const nextBundles: AppBundleRecord[] = []
  const dissolvedBundleIds: string[] = []

  for (const item of items) {
    if (item.type === 'app') {
      if (item.appId !== appId) {
        nextItems.push({ ...item })
      }
      continue
    }

    const bundle = bundles.find((candidate) => candidate.id === item.bundleId)
    if (!bundle) {
      continue
    }
    const appIds = bundle.appIds.filter((id) => id !== appId)
    if (appIds.length === 0) {
      continue
    }
    if (appIds.length === 1) {
      dissolvedBundleIds.push(bundle.id)
      nextItems.push({ type: 'app', appId: appIds[0] as string })
      continue
    }
    nextBundles.push({ ...bundle, appIds })
    nextItems.push({ ...item })
  }

  for (const bundle of bundles) {
    if (
      !nextBundles.some((item) => item.id === bundle.id) &&
      !dissolvedBundleIds.includes(bundle.id)
    ) {
      if (bundle.appIds.includes(appId)) {
        continue
      }
      nextBundles.push({ ...bundle, appIds: [...bundle.appIds] })
    }
  }

  return { items: nextItems, bundles: nextBundles, dissolvedBundleIds }
}

export function mergeApp(
  items: readonly AppGridItemRef[],
  bundles: readonly AppBundleRecord[],
  gridId: string,
  sourceAppId: string,
  targetKey: string,
  createBundleId: () => string
): GridModel & { bundleId: string | null } {
  const sourceIndex = items.findIndex((item) => item.type === 'app' && item.appId === sourceAppId)
  const targetIndex = items.findIndex((item) => itemKey(item) === targetKey)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return { items: items.map((item) => ({ ...item })), bundles: [...bundles], bundleId: null }
  }

  const target = items[targetIndex]
  if (!target) {
    return { items: items.map((item) => ({ ...item })), bundles: [...bundles], bundleId: null }
  }

  const nextItems = items.filter((_, index) => index !== sourceIndex).map((item) => ({ ...item }))
  const sourceShift = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex

  if (target.type === 'bundle') {
    const bundle = bundles.find((candidate) => candidate.id === target.bundleId)
    if (!bundle || bundle.appIds.includes(sourceAppId)) {
      return { items: nextItems, bundles: [...bundles], bundleId: null }
    }
    const nextBundles = bundles.map((candidate) =>
      candidate.id === bundle.id
        ? { ...candidate, appIds: [...candidate.appIds, sourceAppId] }
        : { ...candidate, appIds: [...candidate.appIds] }
    )
    return { items: nextItems, bundles: nextBundles, bundleId: bundle.id }
  }

  const bundleId = createBundleId()
  const bundle: AppBundleRecord = {
    id: bundleId,
    gridId,
    name: 'Bundle',
    appIds: [target.appId, sourceAppId]
  }
  nextItems[sourceShift] = { type: 'bundle', bundleId }
  return {
    items: nextItems,
    bundles: [...bundles.map((item) => ({ ...item, appIds: [...item.appIds] })), bundle],
    bundleId
  }
}

export function removeFromBundle(
  items: readonly AppGridItemRef[],
  bundles: readonly AppBundleRecord[],
  bundleId: string,
  appId: string
): GridModel & { dissolved: boolean; removed: boolean } {
  const bundle = bundles.find((candidate) => candidate.id === bundleId)
  if (!bundle || !bundle.appIds.includes(appId)) {
    return {
      items: items.map((item) => ({ ...item })),
      bundles: bundles.map((item) => ({ ...item, appIds: [...item.appIds] })),
      dissolved: false,
      removed: false
    }
  }

  const appIds = bundle.appIds.filter((id) => id !== appId)
  const dissolved = appIds.length <= 1
  const alreadyOnGrid = items.some((item) => item.type === 'app' && item.appId === appId)
  const nextItems: AppGridItemRef[] = []
  let placedRemovedApp = false

  for (const item of items) {
    if (item.type === 'bundle' && item.bundleId === bundleId) {
      if (appIds.length > 1) {
        nextItems.push({ ...item })
      } else if (appIds.length === 1) {
        nextItems.push({ type: 'app', appId: appIds[0] as string })
      }
      if (!alreadyOnGrid) {
        nextItems.push({ type: 'app', appId })
        placedRemovedApp = true
      }
      continue
    }
    nextItems.push({ ...item })
  }

  if (!alreadyOnGrid && !placedRemovedApp) {
    nextItems.push({ type: 'app', appId })
  }

  return {
    items: nextItems,
    bundles: bundles
      .filter((item) => (dissolved ? item.id !== bundleId : true))
      .map((item) =>
        item.id === bundleId && !dissolved
          ? { ...item, appIds }
          : { ...item, appIds: [...item.appIds] }
      ),
    dissolved,
    removed: true
  }
}

export function renameBundle(
  bundles: readonly AppBundleRecord[],
  bundleId: string,
  name: string
): AppBundleRecord[] {
  return bundles.map((bundle) =>
    bundle.id === bundleId
      ? { ...bundle, name, appIds: [...bundle.appIds] }
      : { ...bundle, appIds: [...bundle.appIds] }
  )
}

export function reorderBundleApps(
  bundles: readonly AppBundleRecord[],
  bundleId: string,
  from: number,
  to: number
): AppBundleRecord[] {
  return bundles.map((bundle) =>
    bundle.id === bundleId
      ? { ...bundle, appIds: moveIds(bundle.appIds, from, to) }
      : { ...bundle, appIds: [...bundle.appIds] }
  )
}

export function resolveGridState(
  widgetId: string,
  items: readonly AppGridItemRef[],
  bundles: readonly AppBundleRecord[],
  apps: readonly AppEntry[],
  title = 'Apps'
): AppGridState {
  const byId = new Map(apps.map((app) => [app.id, app]))
  const bundleViews = new Map<string, AppBundleView>()

  for (const bundle of bundles) {
    if (bundle.gridId !== widgetId) {
      continue
    }
    const bundleApps = bundle.appIds
      .map((appId) => byId.get(appId))
      .filter((app): app is AppEntry => Boolean(app))
    bundleViews.set(bundle.id, {
      id: bundle.id,
      name: bundle.name,
      apps: bundleApps
    })
  }

  const views: AppGridItemView[] = []
  for (const item of items) {
    if (item.type === 'app') {
      const app = byId.get(item.appId)
      if (app) {
        views.push({ key: itemKey(item), type: 'app', app })
      }
      continue
    }
    const bundle = bundleViews.get(item.bundleId)
    if (bundle && bundle.apps.length > 0) {
      views.push({ key: itemKey(item), type: 'bundle', bundle })
    }
  }

  return { widgetId, title, apps: apps.map((app) => ({ ...app })), items: views }
}
