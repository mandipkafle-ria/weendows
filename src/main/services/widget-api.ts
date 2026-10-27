import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  powerMonitor,
  shell,
  type WebContents
} from 'electron'
import {
  APP_GRID_TYPE,
  WIDGET_API_METHOD_MAX,
  WIDGET_API_PARAMS_MAX_BYTES,
  WIDGET_OPEN_LINK_INTERVAL_MS
} from '../../shared/constants'
import {
  appIdsSchema,
  appIdSchema,
  gridMergeSchema,
  gridMoveSchema,
  gridOpenBundleSchema,
  gridRenameTitleSchema
} from '../../shared/schemas'
import type {
  ShellBatterySnapshot,
  WidgetApiError,
  WidgetApiErrorCode,
  WidgetApiRequest,
  WidgetApiResponse,
  WidgetBattery,
  WidgetContext,
  WidgetManifest,
  WidgetPermission,
  WidgetSystemStats
} from '../../shared/types'
import { t } from '../i18n'
import type { LayoutService } from '../windows/layout'
import type { BundlePopoverService } from '../windows/popover-window'
import type { AppGridService } from './app-grid-service'
import type { AppLauncher } from './app-launcher'
import type { AppScanner } from './app-scanner'
import log from './logger'
import { NetProxy, NetProxyError } from './net-proxy'
import { WidgetRateLimitRegistry } from './rate-limiter'
import type { SystemStatsSampler } from './system-stats'
import { WidgetApiError as ApiError } from './widget-api-error'
import { WidgetLogService } from './widget-logs'
import { isPermissionGranted } from './widget-permissions'
import type { WidgetService } from './widget-service'
import type { WidgetStorageService } from './widget-storage'

export interface WidgetApiOptions {
  layout: LayoutService
  widgetService: WidgetService
  storage: WidgetStorageService
  stats: SystemStatsSampler
  net: NetProxy
  launcher: AppLauncher
  appScanner: AppScanner
  appGrid: AppGridService
  popover: BundlePopoverService
  logs?: WidgetLogService
  now?: () => number
}

function failure(code: WidgetApiErrorCode, message: string): WidgetApiResponse {
  return { ok: false, error: { code, message } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function objectParams(request: WidgetApiRequest): Record<string, unknown> {
  if (!isRecord(request.params)) {
    throw new ApiError('invalid_args', 'params must be an object')
  }
  return request.params
}

function validBatterySnapshot(value: unknown): ShellBatterySnapshot | null {
  if (!isRecord(value)) {
    return null
  }
  const snapshot: ShellBatterySnapshot = {}
  if (typeof value['level'] === 'number' && Number.isFinite(value['level'])) {
    snapshot.level = Math.min(1, Math.max(0, value['level']))
  }
  if (typeof value['charging'] === 'boolean') {
    snapshot.charging = value['charging']
  }
  return snapshot
}

export class WidgetApiService {
  private readonly layout: LayoutService
  private readonly widgetService: WidgetService
  private readonly storage: WidgetStorageService
  private readonly stats: SystemStatsSampler
  private readonly net: NetProxy
  private readonly launcher: AppLauncher
  private readonly appScanner: AppScanner
  private readonly appGrid: AppGridService
  private readonly popover: BundlePopoverService
  private readonly logs: WidgetLogService
  private readonly now: () => number
  private readonly rateLimits = new WidgetRateLimitRegistry()
  private readonly linkApprovals = new Map<string, boolean>()
  private readonly lastLinkAt = new Map<string, number>()

  constructor(options: WidgetApiOptions) {
    this.layout = options.layout
    this.widgetService = options.widgetService
    this.storage = options.storage
    this.stats = options.stats
    this.net = options.net
    this.launcher = options.launcher
    this.appScanner = options.appScanner
    this.appGrid = options.appGrid
    this.popover = options.popover
    this.logs = options.logs ?? new WidgetLogService()
    this.now = options.now ?? Date.now
  }

  getLogs(widgetId: string): ReturnType<WidgetLogService['get']> {
    return this.logs.get(widgetId)
  }

  getPreviewStats(): WidgetSystemStats {
    return this.stats.getStats()
  }

  forgetLogs(widgetId: string): void {
    this.logs.forget(widgetId)
  }

  async handle(sender: WebContents, rawRequest: unknown): Promise<WidgetApiResponse> {
    const widgetId = this.layout.widgetIdForSender(sender)
    if (!widgetId) {
      return failure('permission_denied', 'Unknown widget sender')
    }

    let method = 'unknown'
    try {
      const request = this.validateRequest(rawRequest)
      method = request.method

      const isNet = method === 'net.fetch'
      const decision = this.rateLimits.check(widgetId, isNet)
      if (!decision.ok) {
        throw new ApiError(
          'rate_limited',
          decision.net ? 'network call limit reached' : 'call limit reached'
        )
      }

      const manifest = this.widgetService.getManifest(widgetId)
      if (!manifest) {
        throw new ApiError('not_found', 'widget manifest not found')
      }

      const result = await this.dispatch(widgetId, manifest, request, sender)
      return { ok: true, result }
    } catch (error) {
      return this.toFailure(method, error)
    }
  }

  private validateRequest(raw: unknown): WidgetApiRequest {
    if (!isRecord(raw)) {
      throw new ApiError('invalid_args', 'request must be an object')
    }
    if (
      typeof raw['method'] !== 'string' ||
      raw['method'].length === 0 ||
      raw['method'].length > WIDGET_API_METHOD_MAX
    ) {
      throw new ApiError('invalid_args', 'method must be a short string')
    }

    let serialized: string
    try {
      serialized = JSON.stringify(raw['params'] === undefined ? null : raw['params'])
    } catch {
      throw new ApiError('invalid_args', 'params must be JSON')
    }
    if (Buffer.byteLength(serialized) > WIDGET_API_PARAMS_MAX_BYTES) {
      throw new ApiError('too_large', 'params are larger than 64 KB')
    }

    return {
      method: raw['method'],
      params: raw['params'],
      shellBattery: validBatterySnapshot(raw['shellBattery'])
    }
  }

  private async dispatch(
    widgetId: string,
    manifest: WidgetManifest,
    request: WidgetApiRequest,
    sender: WebContents
  ): Promise<unknown> {
    switch (request.method) {
      case 'ready':
        return null

      case 'getContext':
        return this.getContext(sender)

      case 'log': {
        const params = objectParams(request)
        this.logs.add(widgetId, params['level'], params['message'])
        return null
      }

      case 'system.getStats':
        this.requirePermission(manifest, 'system.stats')
        return this.stats.getStats()

      case 'system.getBattery':
        this.requirePermission(manifest, 'system.battery')
        return this.getBattery(request)

      case 'storage.get': {
        this.requirePermission(manifest, 'storage')
        const params = objectParams(request)
        return this.storage.get(widgetId, params['key'])
      }

      case 'storage.set': {
        this.requirePermission(manifest, 'storage')
        const params = objectParams(request)
        return this.storage.set(widgetId, params['key'], params['value'])
      }

      case 'storage.remove': {
        this.requirePermission(manifest, 'storage')
        const params = objectParams(request)
        return this.storage.remove(widgetId, params['key'])
      }

      case 'storage.keys':
        this.requirePermission(manifest, 'storage')
        return this.storage.keys(widgetId)

      case 'net.fetch': {
        this.requirePermission(manifest, 'network')
        const params = objectParams(request)
        const result = await this.net.fetch(params['url'], params['opts'], manifest.allowedHosts)
        return { ok: result.ok, status: result.status, text: result.text }
      }

      case 'launch.app': {
        this.requirePermission(manifest, 'launch')
        const params = objectParams(request)
        await this.launcher.launch(params['appId'])
        return { ok: true }
      }

      case 'apps.list': {
        this.requireAppGrid(manifest)
        return this.appScanner.list()
      }

      case 'apps.refresh': {
        this.requireAppGrid(manifest)
        return this.appScanner.refresh()
      }

      case 'grid.getState': {
        this.requireAppGrid(manifest)
        return this.appGrid.state(widgetId)
      }

      case 'grid.renameTitle': {
        this.requireAppGrid(manifest)
        const params = objectParams(request)
        const { title } = gridRenameTitleSchema.parse(params)
        return this.appGrid.renameTitle(widgetId, title)
      }

      case 'grid.addApps': {
        this.requireAppGrid(manifest)
        const params = objectParams(request)
        const appIds = appIdsSchema.parse(params['appIds'])
        return this.appGrid.addApps(widgetId, appIds)
      }

      case 'grid.removeApp': {
        this.requireAppGrid(manifest)
        const params = objectParams(request)
        const appId = appIdSchema.parse(params['appId'])
        return this.appGrid.removeApp(widgetId, appId)
      }

      case 'grid.move': {
        this.requireAppGrid(manifest)
        const params = objectParams(request)
        const { from, to } = gridMoveSchema.parse(params)
        return this.appGrid.move(widgetId, from, to)
      }

      case 'grid.merge': {
        this.requireAppGrid(manifest)
        const params = objectParams(request)
        const { appId, targetKey } = gridMergeSchema.parse(params)
        return this.appGrid.merge(widgetId, appId, targetKey)
      }

      case 'grid.openBundle': {
        this.requireAppGrid(manifest)
        const params = objectParams(request)
        const { bundleId, rect } = gridOpenBundleSchema.parse(params)
        if (!this.appGrid.bundleState(widgetId, bundleId)) {
          throw new ApiError('not_found', 'bundle not found')
        }
        await this.popover.open({ widgetId, bundleId, rect, sender })
        return { ok: true }
      }

      case 'openLink': {
        this.requirePermission(manifest, 'openLink')
        const params = objectParams(request)
        await this.openLink(widgetId, params['url'], sender)
        return { ok: true }
      }

      default:
        throw new ApiError('invalid_args', 'unknown method')
    }
  }

  private getContext(sender: WebContents): WidgetContext {
    const window = BrowserWindow.fromWebContents(sender)
    const [width = 0, height = 0] = window ? window.getContentSize() : []
    return {
      width,
      height,
      dark: nativeTheme.shouldUseDarkColors,
      locale: app.getLocale(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }

  private getBattery(request: WidgetApiRequest): WidgetBattery {
    const snapshot = request.shellBattery
    if (snapshot && (snapshot.level !== undefined || snapshot.charging !== undefined)) {
      const battery: WidgetBattery = {}
      if (snapshot.level !== undefined) {
        battery.level = snapshot.level
      }
      if (snapshot.charging !== undefined) {
        battery.charging = snapshot.charging
      }
      return battery
    }

    return { charging: !powerMonitor.isOnBatteryPower() }
  }

  private async openLink(widgetId: string, rawUrl: unknown, sender: WebContents): Promise<void> {
    if (typeof rawUrl !== 'string') {
      throw new ApiError('invalid_args', 'url must be a string')
    }

    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      throw new ApiError('invalid_args', 'url is not valid')
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new ApiError('invalid_args', 'only http and https links are allowed')
    }
    if (url.username || url.password) {
      throw new ApiError('invalid_args', 'credentials in the url are not allowed')
    }

    const now = this.now()
    const previous = this.lastLinkAt.get(widgetId) ?? 0
    if (now - previous < WIDGET_OPEN_LINK_INTERVAL_MS) {
      throw new ApiError('rate_limited', 'openLink can run once every 3 seconds')
    }
    this.lastLinkAt.set(widgetId, now)

    let approved = this.linkApprovals.get(widgetId)
    if (approved === undefined) {
      const parent = BrowserWindow.fromWebContents(sender)
      const options = {
        type: 'question' as const,
        buttons: [t('common.cancel'), t('common.open')],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
        title: t('dialog.openLinkTitle'),
        message: t('dialog.openLinkMessage', { host: url.hostname }),
        detail: url.toString()
      }
      const result =
        parent && !parent.isDestroyed()
          ? await dialog.showMessageBox(parent, options)
          : await dialog.showMessageBox(options)
      approved = result.response === 1
      this.linkApprovals.set(widgetId, approved)
    }

    if (!approved) {
      throw new ApiError('permission_denied', 'opening links was not approved')
    }

    await shell.openExternal(url.toString())
  }

  private requirePermission(manifest: WidgetManifest, permission: WidgetPermission): void {
    if (!isPermissionGranted(manifest, permission)) {
      throw new ApiError('permission_denied', `permission not granted: ${permission}`)
    }
  }

  private requireAppGrid(manifest: WidgetManifest): void {
    if (manifest.builtinType !== APP_GRID_TYPE) {
      throw new ApiError('permission_denied', 'only the App Grid can use app APIs')
    }
    this.requirePermission(manifest, 'launch')
  }

  private toFailure(method: string, error: unknown): WidgetApiResponse {
    if (error instanceof ApiError) {
      return failure(error.code, error.message)
    }
    if (error instanceof NetProxyError) {
      return failure(error.code, error.message)
    }

    log.error('Widget API call failed', {
      method,
      error: error instanceof Error ? error.message : String(error)
    })
    const internal: WidgetApiError = { code: 'internal', message: 'Internal error' }
    return { ok: false, error: internal }
  }
}
