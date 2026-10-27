import {
  dialog,
  Menu,
  powerMonitor,
  screen,
  type BrowserWindow,
  type Display,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'
import {
  findBuiltin,
  findBuiltinVariant,
  isEditPassthroughWidget,
  isFocusableWidget
} from '../../shared/builtins'
import {
  AI_PREVIEW_PREFIX,
  CLOCK_WIDGET_ID,
  MAGNETISM_DIP,
  MIN_VISIBLE_DIP,
  SNAP_STEP_DIP,
  WIDGET_CASCADE_OFFSET_DIP,
  WIDGET_CRASH_LIMIT,
  WIDGET_CRASH_WINDOW_MS,
  WIDGET_DRAG_INTERVAL_MS,
  WIDGET_DRAG_WATCHDOG_MS,
  WIDGET_FOREGROUND_REPIN_INTERVAL_MS,
  WIDGET_FOREGROUND_REPIN_MS,
  WIDGET_PIN_INTERVAL_MS
} from '../../shared/constants'
import { IPC } from '../../shared/ipc'
import { effectiveMinSize } from '../../shared/widget-size'
import type {
  CursorStyle,
  ShellState,
  WidgetEventName,
  WidgetManifest,
  WidgetPlacement,
  WidgetSummary
} from '../../shared/types'
import { t } from '../i18n'
import { getEditMode, setEditMode } from '../services/edit-mode'
import log from '../services/logger'
import type { NoticeService } from '../services/notices'
import type { WidgetService } from '../services/widget-service'
import { watchForeground } from '../native/foreground-watcher'
import { isAltDown } from '../native/win32'
import {
  logPinStrategy,
  nativeWindowHandle,
  pinWithFallback,
  type ResolvedPinStrategy
} from '../native/desktop-layer'
import {
  boundsForPlacement,
  centerBounds,
  clampPlacement,
  clampRect,
  displayForPlacement,
  magnetize,
  placementFromBounds,
  snapRect,
  type DisplayLike,
  type Point,
  type Rect
} from './layout-math'
import { createWidgetBadge, type WidgetBadge } from './widget-badge-window'
import { createWidgetWindow, loadWidgetShell } from './widget-window'
import { showSettingsWindow } from './settings-window'

export interface LayoutServiceOptions {
  widgetService: WidgetService
  notices: NoticeService
  safe: boolean
  cursorStyle?: () => CursorStyle
}

interface ManagedWidget {
  widgetId: string
  manifest: WidgetManifest
  win: BrowserWindow
}

export interface WidgetRuntimeSnapshot {
  widgetId: string
  running: boolean
  processId: number | null
  failures: number
  enabled: boolean
  disabledReason: string | null
}

interface PointerState {
  widgetId: string
  kind: 'drag' | 'resize'
  timer: NodeJS.Timeout
  watchdog: NodeJS.Timeout
  startCursor: Point
  startBounds: Rect
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toDisplayLike(display: Display): DisplayLike {
  return {
    id: String(display.id),
    bounds: { ...display.bounds },
    workArea: { ...display.workArea }
  }
}

function withoutWidgetId(placement: WidgetPlacement): Omit<WidgetPlacement, 'widgetId'> {
  return {
    displayId: placement.displayId,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    zOrder: placement.zOrder,
    locked: placement.locked,
    enabled: placement.enabled,
    opacity: placement.opacity
  }
}

export class LayoutService {
  private readonly widgetService: WidgetService
  private readonly notices: NoticeService
  private readonly safe: boolean
  private readonly cursorStyle: () => CursorStyle
  private readonly managed = new Map<string, ManagedWidget>()
  private readonly previews = new Map<string, WidgetPlacement>()
  private readonly changeListeners = new Set<() => void>()
  private readonly badges = new Map<string, WidgetBadge>()
  private readonly badgeSenders = new Map<number, string>()
  private readonly failures = new Map<string, number[]>()
  private readonly disabledReasons = new Map<string, string>()
  private readonly reloading = new Set<string>()
  private readonly autoReloadTimers = new Map<string, NodeJS.Timeout>()
  private readonly resizeTimers = new Map<string, NodeJS.Timeout>()
  private pointer: PointerState | null = null
  private maintenanceTimer: NodeJS.Timeout | null = null
  private displayDebounce: NodeJS.Timeout | null = null
  private foregroundBurstTimer: NodeJS.Timeout | null = null
  private foregroundBurstStop: NodeJS.Timeout | null = null
  private stopForegroundWatch: (() => void) | null = null
  private pinResolved: ResolvedPinStrategy | null = null
  private started = false
  private stopping = false

  constructor(options: LayoutServiceOptions) {
    this.widgetService = options.widgetService
    this.notices = options.notices
    this.safe = options.safe
    this.cursorStyle = options.cursorStyle ?? (() => 'system')
  }

  start(): void {
    if (this.started) {
      return
    }

    this.started = true
    this.pinResolved = logPinStrategy()
    powerMonitor.on('unlock-screen', this.handleWake)
    powerMonitor.on('resume', this.handleWake)
    screen.on('display-added', this.handleDisplayChange)
    screen.on('display-removed', this.handleDisplayChange)
    screen.on('display-metrics-changed', this.handleDisplayChange)
    this.maintenanceTimer = setInterval(() => this.repinAll('interval'), WIDGET_PIN_INTERVAL_MS)
    this.stopForegroundWatch = watchForeground(this.handleForegroundChange)
  }

  stop(): void {
    this.stopping = true
    this.stopForegroundBurst()
    this.stopForegroundWatch?.()
    this.stopForegroundWatch = null
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer)
      this.maintenanceTimer = null
    }
    if (this.displayDebounce) {
      clearTimeout(this.displayDebounce)
      this.displayDebounce = null
    }
    if (this.pointer) {
      this.finishPointer(true)
    } else {
      this.clearPointer()
    }

    powerMonitor.removeListener('unlock-screen', this.handleWake)
    powerMonitor.removeListener('resume', this.handleWake)
    screen.removeListener('display-added', this.handleDisplayChange)
    screen.removeListener('display-removed', this.handleDisplayChange)
    screen.removeListener('display-metrics-changed', this.handleDisplayChange)

    for (const widgetId of [...this.managed.keys()]) {
      this.detach(widgetId)
    }
    this.previews.clear()
    this.started = false
  }

  onWidgetsChanged(listener: () => void): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  getSummaries(): WidgetSummary[] {
    return this.widgetService.listSummaries()
  }

  async ensureFirstRun(): Promise<void> {
    if (this.safe) {
      return
    }
    if (!this.widgetService.layoutWasMissing && !this.widgetService.layoutRecovered) {
      return
    }
    if (this.widgetService.listPlacements().length > 0) {
      return
    }

    try {
      const manifest = await this.widgetService.ensureBuiltin(CLOCK_WIDGET_ID)
      const display = toDisplayLike(screen.getPrimaryDisplay())
      const placement: WidgetPlacement = {
        widgetId: manifest.id,
        displayId: display.id,
        x: display.workArea.x - display.bounds.x + 48,
        y: display.workArea.y - display.bounds.y + 48,
        width: manifest.width,
        height: manifest.height,
        zOrder: this.widgetService.nextZOrder(),
        locked: false,
        enabled: true,
        opacity: 1
      }
      this.widgetService.addPlacement(clampPlacement(placement, display, MIN_VISIBLE_DIP))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('Could not create the first widget', message)
      this.notices.add('warning', `Could not create the default clock: ${message}`)
    }
  }

  async restore(): Promise<void> {
    if (this.safe) {
      return
    }

    for (const summary of this.widgetService.listSummaries()) {
      if (!summary.placement.enabled || this.managed.has(summary.manifest.id)) {
        continue
      }
      await this.openWidget(summary.manifest, summary.placement)
      await delay(100)
    }
  }

  async addWidget(builtinType: string, variantId?: string): Promise<WidgetSummary> {
    if (this.safe) {
      throw new Error('Safe mode is enabled')
    }

    const builtin = findBuiltin(builtinType)
    if (!builtin) {
      throw new Error(`Unknown widget type: ${builtinType}`)
    }
    if (variantId && !builtin.variants.some((variant) => variant.id === variantId)) {
      throw new Error(`Unknown design: ${variantId}`)
    }

    const variant = findBuiltinVariant(builtin, variantId)
    const placement = this.nextPlacementForSize(variant.width, variant.height)
    const summary = await this.widgetService.create(builtin, placement, variant.id)
    await this.openWidget(summary.manifest, summary.placement)
    this.emitChanged()
    return summary
  }

  async addAiWidgetCopy(widgetId: string): Promise<WidgetSummary> {
    if (this.safe) {
      throw new Error('Safe mode is enabled')
    }

    const source = this.widgetService.getManifest(widgetId)
    if (!source || source.kind !== 'ai') {
      throw new Error('Saved AI widget not found.')
    }

    const placement = this.nextPlacementForSize(source.width, source.height)
    const summary = await this.widgetService.duplicate(widgetId, placement)
    await this.openWidget(summary.manifest, summary.placement)
    this.emitChanged()
    return summary
  }

  async openPreview(manifest: WidgetManifest): Promise<void> {
    this.closePreview(manifest.id)
    const display = toDisplayLike(screen.getPrimaryDisplay())
    const bounds = centerBounds(
      display.workArea,
      { width: manifest.width, height: manifest.height },
      0,
      0
    )
    const placement = clampPlacement(
      {
        widgetId: manifest.id,
        displayId: display.id,
        x: bounds.x - display.bounds.x,
        y: bounds.y - display.bounds.y,
        width: bounds.width,
        height: bounds.height,
        zOrder: this.widgetService.nextZOrder(),
        locked: true,
        enabled: true,
        opacity: 1
      },
      display,
      MIN_VISIBLE_DIP
    )
    this.previews.set(manifest.id, placement)
    try {
      await this.openWidget(manifest, placement)
    } catch (error) {
      this.previews.delete(manifest.id)
      throw error
    }
  }

  closePreview(widgetId: string): void {
    this.previews.delete(widgetId)
    this.detach(widgetId)
  }

  closeAllPreviews(): void {
    for (const widgetId of [...this.previews.keys()]) {
      this.closePreview(widgetId)
    }
  }

  getRuntimeSnapshots(): WidgetRuntimeSnapshot[] {
    return this.widgetService.listSummaries().map((summary) => {
      const managed = this.managed.get(summary.manifest.id)
      let processId: number | null = null
      if (managed && !managed.win.isDestroyed()) {
        try {
          processId = managed.win.webContents.getOSProcessId() || null
        } catch {
          processId = null
        }
      }
      return {
        widgetId: summary.manifest.id,
        running: managed !== undefined && !managed.win.isDestroyed(),
        processId,
        failures: this.failures.get(summary.manifest.id)?.length ?? 0,
        enabled: summary.placement.enabled,
        disabledReason: this.disabledReasons.get(summary.manifest.id) ?? null
      }
    })
  }

  async setWidgetEnabled(widgetId: string, enabled: boolean): Promise<WidgetSummary | null> {
    if (enabled && this.safe) {
      throw new Error('Safe mode is enabled')
    }
    const placement = this.widgetService.updatePlacement(widgetId, { enabled })
    if (!placement) {
      return null
    }

    this.disabledReasons.delete(widgetId)
    if (enabled) {
      const manifest = this.widgetService.getManifest(widgetId)
      if (manifest) {
        await this.openWidget(manifest, placement)
      }
    } else {
      this.failures.delete(widgetId)
      this.detach(widgetId)
    }
    this.emitChanged()
    return (
      this.widgetService.listSummaries().find((summary) => summary.manifest.id === widgetId) ?? null
    )
  }

  async duplicateWidget(widgetId: string): Promise<WidgetSummary> {
    if (this.safe) {
      throw new Error('Safe mode is enabled')
    }
    const source = this.widgetService.getManifest(widgetId)
    if (!source) {
      throw new Error('Widget not found.')
    }
    const placement = this.nextPlacementForSize(source.width, source.height)
    const summary = await this.widgetService.duplicate(widgetId, placement)
    await this.openWidget(summary.manifest, summary.placement)
    this.emitChanged()
    return summary
  }

  async resetLayout(): Promise<void> {
    for (const widgetId of [...this.managed.keys()]) {
      this.detach(widgetId)
    }
    this.closeAllPreviews()
    this.widgetService.clearPlacements()
    this.disabledReasons.clear()
    this.failures.clear()
    for (const timer of this.autoReloadTimers.values()) {
      clearTimeout(timer)
    }
    this.autoReloadTimers.clear()
    this.emitChanged()
  }

  async openWidgetById(widgetId: string): Promise<void> {
    const manifest = this.widgetService.getManifest(widgetId)
    const placement = this.previews.get(widgetId) ?? this.widgetService.getPlacement(widgetId)
    if (!manifest || !placement || !placement.enabled) {
      throw new Error('Widget not found.')
    }
    await this.openWidget(manifest, placement)
  }

  nextPlacementForSize(width: number, height: number): Omit<WidgetPlacement, 'widgetId'> {
    const display = toDisplayLike(screen.getPrimaryDisplay())
    const count = this.widgetService.listPlacements().length
    const bounds = centerBounds(
      display.workArea,
      { width, height },
      count,
      WIDGET_CASCADE_OFFSET_DIP
    )
    const placement: WidgetPlacement = {
      widgetId: 'pending',
      displayId: display.id,
      x: bounds.x - display.bounds.x,
      y: bounds.y - display.bounds.y,
      width: bounds.width,
      height: bounds.height,
      zOrder: this.widgetService.nextZOrder(),
      locked: false,
      enabled: true,
      opacity: 1
    }
    return withoutWidgetId(clampPlacement(placement, display, MIN_VISIBLE_DIP))
  }

  async removeWidget(widgetId: string, parent: BrowserWindow | null): Promise<boolean> {
    const managed = this.managed.get(widgetId)
    const manifest = managed?.manifest ?? this.widgetService.getManifest(widgetId)
    if (!manifest || !this.widgetService.getPlacement(widgetId)) {
      return false
    }

    const options = {
      type: 'warning' as const,
      buttons: [t('common.cancel'), t('common.remove')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: t('dialog.removeTitle', { name: manifest.name }),
      message: t('dialog.removeMessage', { name: manifest.name }),
      detail: manifest.kind === 'ai' ? t('dialog.removeAiDetail') : t('dialog.removeBuiltinDetail')
    }
    const result =
      parent && !parent.isDestroyed()
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options)
    if (result.response !== 1) {
      return false
    }

    this.detach(widgetId)
    this.disabledReasons.delete(widgetId)
    await this.widgetService.remove(widgetId)
    this.emitChanged()
    return true
  }

  async deleteAiWidget(widgetId: string, parent: BrowserWindow | null): Promise<boolean> {
    const manifest = this.widgetService.getManifest(widgetId)
    if (!manifest || manifest.kind !== 'ai') {
      return false
    }
    if (this.widgetService.getPlacement(widgetId)) {
      throw new Error('Remove the widget from the desktop before deleting it.')
    }

    const options = {
      type: 'warning' as const,
      buttons: [t('common.cancel'), t('dialog.deleteButton')],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: t('dialog.deleteTitle', { name: manifest.name }),
      message: t('dialog.deleteMessage', { name: manifest.name }),
      detail: t('dialog.deleteDetail')
    }
    const result =
      parent && !parent.isDestroyed()
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options)
    if (result.response !== 1) {
      return false
    }

    const deleted = await this.widgetService.delete(widgetId)
    if (deleted) {
      this.emitChanged()
    }
    return deleted
  }

  async removeWidgetForSender(sender: WebContents): Promise<boolean> {
    const widgetId = this.widgetIdForSender(sender)
    if (!widgetId) {
      return false
    }
    const managed = this.managed.get(widgetId)
    return this.removeWidget(widgetId, managed?.win ?? null)
  }

  setLocked(widgetId: string, locked: boolean): boolean {
    const placement = this.widgetService.updatePlacement(widgetId, { locked })
    if (!placement) {
      return false
    }
    const managed = this.managed.get(widgetId)
    if (managed) {
      this.sendState(managed)
    }
    this.emitChanged()
    return true
  }

  setOpacity(widgetId: string, opacity: number): boolean {
    const placement = this.widgetService.updatePlacement(widgetId, { opacity })
    if (!placement) {
      return false
    }
    const managed = this.managed.get(widgetId)
    if (managed) {
      this.sendState(managed)
    }
    this.emitChanged()
    return true
  }

  async setWidgetVariant(widgetId: string, variantId: string): Promise<WidgetSummary | null> {
    const manifest = await this.widgetService.setBuiltinVariant(widgetId, variantId)
    const managed = this.managed.get(widgetId)
    if (managed) {
      managed.manifest = manifest
    }
    this.reloadWidget(widgetId)
    this.emitChanged()
    return this.widgetService.getSummary(widgetId)
  }

  reloadWidget(widgetId: string): void {
    const managed = this.managed.get(widgetId)
    const placement = this.previews.get(widgetId) ?? this.widgetService.getPlacement(widgetId)
    const manifest = this.widgetService.getManifest(widgetId)
    if (!managed || managed.win.isDestroyed() || !placement || !manifest) {
      return
    }

    this.clearAutoReload(widgetId)
    this.reloading.add(widgetId)
    this.destroyBadge(widgetId)
    this.managed.delete(widgetId)
    managed.win.destroy()
    void this.openWidget(manifest, placement).finally(() => {
      this.reloading.delete(widgetId)
    })
  }

  widgetIdForSender(sender: WebContents): string | null {
    for (const managed of this.managed.values()) {
      if (!managed.win.isDestroyed() && managed.win.webContents === sender) {
        return managed.widgetId
      }
    }
    return null
  }

  stateForSender(sender: WebContents): ShellState | null {
    const widgetId = this.widgetIdForSender(sender)
    if (!widgetId) {
      return null
    }
    const managed = this.managed.get(widgetId)
    return managed ? this.stateFor(managed) : null
  }

  broadcastState(): void {
    for (const managed of this.managed.values()) {
      if (!managed.win.isDestroyed()) {
        this.sendState(managed)
      }
    }
  }

  broadcastWidgetEvent(event: WidgetEventName, data: unknown): void {
    for (const managed of this.managed.values()) {
      if (!managed.win.isDestroyed()) {
        managed.win.webContents.send(IPC.widgetEvent, { event, data })
      }
    }
  }

  notifyChanged(): void {
    this.emitChanged()
  }

  reportWidgetUnresponsive(widgetId: string): void {
    const managed = this.managed.get(widgetId)
    if (!managed) {
      return
    }
    this.handleWidgetFailure(managed, 'not responding')
  }

  reportWidgetResponsive(widgetId: string): void {
    this.destroyBadge(widgetId)
  }

  handleBadgeAction(sender: WebContents, rawAction: unknown): void {
    const widgetId = this.badgeSenders.get(sender.id)
    if (!widgetId) {
      return
    }
    if (rawAction !== 'reload' && rawAction !== 'disable') {
      return
    }

    const managed = this.managed.get(widgetId)
    if (!managed) {
      this.destroyBadge(widgetId)
      return
    }

    if (rawAction === 'reload') {
      this.destroyBadge(widgetId)
      this.reloadWidget(widgetId)
      return
    }

    this.disableWidget(widgetId, t('widgets.badgeDisableReason'))
  }

  startDrag(widgetId: string): void {
    const managed = this.managed.get(widgetId)
    const placement = this.widgetService.getPlacement(widgetId)
    if (!managed || !placement || placement.locked || !getEditMode() || managed.win.isDestroyed()) {
      return
    }

    this.clearPointer()
    const startCursor = screen.getCursorScreenPoint()
    const startBounds = managed.win.getBounds()
    const timer = setInterval(() => this.updateDrag(managed), WIDGET_DRAG_INTERVAL_MS)
    const watchdog = setTimeout(() => this.finishPointer(true), WIDGET_DRAG_WATCHDOG_MS)
    this.pointer = {
      widgetId,
      kind: 'drag',
      timer,
      watchdog,
      startCursor,
      startBounds
    }
  }

  startResize(widgetId: string): void {
    const managed = this.managed.get(widgetId)
    const placement = this.widgetService.getPlacement(widgetId)
    if (!managed || !placement || placement.locked || !getEditMode() || managed.win.isDestroyed()) {
      return
    }

    this.clearPointer()
    const startCursor = screen.getCursorScreenPoint()
    const startBounds = managed.win.getBounds()
    const timer = setInterval(() => this.updateResize(managed), WIDGET_DRAG_INTERVAL_MS)
    const watchdog = setTimeout(() => this.finishPointer(true), WIDGET_DRAG_WATCHDOG_MS)
    this.pointer = {
      widgetId,
      kind: 'resize',
      timer,
      watchdog,
      startCursor,
      startBounds
    }
  }

  finishDrag(): void {
    if (this.pointer?.kind === 'drag') {
      this.finishPointer(true)
    }
  }

  finishResize(): void {
    if (this.pointer?.kind === 'resize') {
      this.finishPointer(true)
    }
  }

  private async openWidget(manifest: WidgetManifest, placement: WidgetPlacement): Promise<void> {
    const existing = this.managed.get(manifest.id)
    if (existing) {
      this.syncWindow(existing, placement)
      return
    }

    const display = this.resolveDisplay(placement)
    const effective = clampPlacement(
      this.withMinimumSize(manifest, placement),
      display,
      MIN_VISIBLE_DIP
    )
    const bounds = boundsForPlacement(effective, display)
    const win = createWidgetWindow({
      widgetId: manifest.id,
      title: manifest.name,
      bounds,
      focusable: isFocusableWidget(manifest)
    })
    const managed: ManagedWidget = {
      widgetId: manifest.id,
      manifest,
      win
    }
    this.managed.set(manifest.id, managed)

    win.on('show', () => this.pinWindow(managed, 'show'))
    win.on('focus', () => this.pinWindow(managed, 'focus'))
    win.on('blur', () => this.pinWindow(managed, 'blur'))
    win.on('unresponsive', () => {
      if (!this.stopping) this.handleWidgetFailure(managed, 'not responding')
    })
    win.on('responsive', () => this.destroyBadge(manifest.id))
    win.on('resize', () => {
      this.sendResizeEvent(managed)
      this.badges.get(manifest.id)?.reposition(win.getBounds())
    })
    win.on('move', () => this.badges.get(manifest.id)?.reposition(win.getBounds()))
    win.on('closed', () => {
      if (this.pointer?.widgetId === manifest.id) {
        this.clearPointer()
      }
      this.destroyBadge(manifest.id)
      if (this.managed.get(manifest.id) === managed) {
        this.managed.delete(manifest.id)
      }
      if (manifest.id.startsWith(AI_PREVIEW_PREFIX)) {
        this.previews.delete(manifest.id)
      }
    })
    win.webContents.on('context-menu', () => {
      if (!getEditMode()) {
        this.showContextMenu(managed)
      }
    })
    win.webContents.on('render-process-gone', (_event, details) => {
      log.error('Widget renderer gone', { widget: manifest.id, details })
      // Don't count as a crash when the app is shutting down, the widget is
      // being intentionally detached/reloaded, or the renderer exited cleanly
      // (e.g. win.destroy()).  This avoids false-positive crash badges during
      // dev restarts and normal shutdown.
      if (this.stopping || details.reason === 'clean-exit') {
        return
      }
      this.handleWidgetFailure(managed, 'crashed')
    })
    win.webContents.on('did-finish-load', () => this.destroyBadge(manifest.id))

    try {
      await loadWidgetShell(win, manifest.id, this.variantFor(manifest))
      this.sendState(managed)
    } catch (error) {
      log.error('Could not load widget shell', { widget: manifest.id, error })
      this.detach(manifest.id)
    }
  }

  private syncWindow(managed: ManagedWidget, placement: WidgetPlacement): void {
    if (managed.win.isDestroyed()) {
      return
    }
    const display = this.resolveDisplay(placement)
    const effective = clampPlacement(
      this.withMinimumSize(managed.manifest, placement),
      display,
      MIN_VISIBLE_DIP
    )
    managed.win.setBounds(boundsForPlacement(effective, display))
    managed.manifest = this.widgetService.getManifest(managed.widgetId) ?? managed.manifest
    const focusable = isFocusableWidget(managed.manifest)
    if (managed.win.isFocusable() !== focusable) {
      managed.win.setFocusable(focusable)
    }
    this.sendState(managed)
  }

  private variantFor(manifest: WidgetManifest): string | null {
    if (!manifest.builtinType) {
      return null
    }
    const builtin = findBuiltin(manifest.builtinType)
    return builtin ? findBuiltinVariant(builtin, manifest.variant).id : (manifest.variant ?? null)
  }

  private withMinimumSize(manifest: WidgetManifest, placement: WidgetPlacement): WidgetPlacement {
    const limits = effectiveMinSize(manifest)
    if (placement.width >= limits.minWidth && placement.height >= limits.minHeight) {
      return placement
    }
    return {
      ...placement,
      width: Math.max(placement.width, limits.minWidth),
      height: Math.max(placement.height, limits.minHeight)
    }
  }

  private resolveDisplay(placement: WidgetPlacement): DisplayLike {
    const primary = toDisplayLike(screen.getPrimaryDisplay())
    const displays = screen.getAllDisplays().map(toDisplayLike)
    return displayForPlacement(placement, displays, primary)
  }

  private stateFor(managed: ManagedWidget): ShellState {
    const placement =
      this.previews.get(managed.widgetId) ?? this.widgetService.getPlacement(managed.widgetId)
    return {
      widgetId: managed.widgetId,
      variant: this.variantFor(managed.manifest),
      editMode: getEditMode(),
      locked: placement?.locked ?? false,
      opacity: placement?.opacity ?? 1,
      cursorStyle: this.cursorStyle(),
      editPassthrough: isEditPassthroughWidget(managed.manifest)
    }
  }

  private sendState(managed: ManagedWidget): void {
    if (managed.win.isDestroyed()) {
      return
    }
    managed.win.webContents.send(IPC.shellStateChanged, this.stateFor(managed))
  }

  private updateDrag(managed: ManagedWidget): void {
    const pointer = this.pointer
    if (
      !pointer ||
      pointer.kind !== 'drag' ||
      pointer.widgetId !== managed.widgetId ||
      managed.win.isDestroyed()
    ) {
      this.clearPointer()
      return
    }

    const cursor = screen.getCursorScreenPoint()
    const proposed: Rect = {
      x: pointer.startBounds.x + cursor.x - pointer.startCursor.x,
      y: pointer.startBounds.y + cursor.y - pointer.startCursor.y,
      width: pointer.startBounds.width,
      height: pointer.startBounds.height
    }
    const display = toDisplayLike(screen.getDisplayMatching(proposed))
    let next = clampRect(proposed, display.workArea, MIN_VISIBLE_DIP)

    if (!isAltDown()) {
      const magnet = magnetize(next, this.otherBounds(managed.widgetId), MAGNETISM_DIP)
      next = clampRect({ ...next, x: magnet.x, y: magnet.y }, display.workArea, MIN_VISIBLE_DIP)
    }

    managed.win.setBounds({
      x: Math.round(next.x),
      y: Math.round(next.y),
      width: Math.round(next.width),
      height: Math.round(next.height)
    })
  }

  private updateResize(managed: ManagedWidget): void {
    const pointer = this.pointer
    if (
      !pointer ||
      pointer.kind !== 'resize' ||
      pointer.widgetId !== managed.widgetId ||
      managed.win.isDestroyed()
    ) {
      this.clearPointer()
      return
    }

    const cursor = screen.getCursorScreenPoint()
    const display = toDisplayLike(screen.getDisplayMatching(pointer.startBounds))
    const limits = effectiveMinSize(managed.manifest)
    const minWidth = Math.max(1, limits.minWidth)
    const minHeight = Math.max(1, limits.minHeight)
    const maxWidth = Math.max(
      minWidth,
      display.workArea.x + display.workArea.width - pointer.startBounds.x
    )
    const maxHeight = Math.max(
      minHeight,
      display.workArea.y + display.workArea.height - pointer.startBounds.y
    )
    const width = Math.min(
      maxWidth,
      Math.max(minWidth, pointer.startBounds.width + cursor.x - pointer.startCursor.x)
    )
    const height = Math.min(
      maxHeight,
      Math.max(minHeight, pointer.startBounds.height + cursor.y - pointer.startCursor.y)
    )

    managed.win.setBounds({
      x: pointer.startBounds.x,
      y: pointer.startBounds.y,
      width: Math.round(width),
      height: Math.round(height)
    })
  }

  private finishPointer(save: boolean): void {
    const pointer = this.pointer
    if (!pointer) {
      return
    }
    this.clearPointer()
    if (!save) {
      return
    }

    const managed = this.managed.get(pointer.widgetId)
    if (!managed || managed.win.isDestroyed()) {
      return
    }
    const current = managed.win.getBounds()
    const display = toDisplayLike(screen.getDisplayMatching(current))
    const limits = effectiveMinSize(managed.manifest)
    const minWidth = Math.max(1, limits.minWidth)
    const minHeight = Math.max(1, limits.minHeight)
    const snapped = snapRect(current, SNAP_STEP_DIP)
    const bounds: Rect =
      pointer.kind === 'drag'
        ? {
            x: snapped.x,
            y: snapped.y,
            width: current.width,
            height: current.height
          }
        : {
            x: current.x,
            y: current.y,
            width: Math.max(minWidth, snapped.width),
            height: Math.max(minHeight, snapped.height)
          }
    const clamped = clampRect(bounds, display.workArea, MIN_VISIBLE_DIP)
    managed.win.setBounds({
      x: Math.round(clamped.x),
      y: Math.round(clamped.y),
      width: Math.round(clamped.width),
      height: Math.round(clamped.height)
    })

    const placement = this.widgetService.getPlacement(pointer.widgetId)
    if (!placement) {
      return
    }
    this.widgetService.updatePlacement(
      pointer.widgetId,
      withoutWidgetId(placementFromBounds(placement, clamped, display))
    )
    this.emitChanged()
  }

  private clearPointer(): void {
    if (!this.pointer) {
      return
    }
    clearInterval(this.pointer.timer)
    clearTimeout(this.pointer.watchdog)
    this.pointer = null
  }

  private otherBounds(widgetId: string): Rect[] {
    const bounds: Rect[] = []
    for (const managed of this.managed.values()) {
      if (managed.widgetId !== widgetId && !managed.win.isDestroyed()) {
        bounds.push(managed.win.getBounds())
      }
    }
    return bounds
  }

  private showContextMenu(managed: ManagedWidget): void {
    const placement = this.widgetService.getPlacement(managed.widgetId)
    if (!placement) {
      return
    }

    const opacityItems: MenuItemConstructorOptions[] = [1, 0.8, 0.6].map((value) => ({
      label: `${Math.round(value * 100)}%`,
      type: 'radio',
      checked: Math.abs(placement.opacity - value) < 0.01,
      click: () => this.setOpacity(managed.widgetId, value)
    }))
    const template: MenuItemConstructorOptions[] = [
      { label: t('menu.editLayout'), click: () => setEditMode(true) },
      ...(managed.widgetId.startsWith(AI_PREVIEW_PREFIX)
        ? []
        : [
            {
              label: t('menu.editWithAi'),
              click: () => showSettingsWindow({ editWidgetId: managed.widgetId })
            }
          ]),
      { type: 'separator' },
      {
        label: placement.locked ? t('menu.unlockWidget') : t('menu.lockWidget'),
        click: () => this.setLocked(managed.widgetId, !placement.locked)
      },
      { label: t('menu.opacity'), submenu: opacityItems },
      { type: 'separator' },
      { label: t('menu.reloadWidget'), click: () => this.reloadWidget(managed.widgetId) },
      {
        label: t('menu.removeWidget'),
        click: () => {
          void this.removeWidget(managed.widgetId, managed.win)
        }
      }
    ]

    Menu.buildFromTemplate(template).popup({ window: managed.win })
  }

  private sendResizeEvent(managed: ManagedWidget): void {
    const existing = this.resizeTimers.get(managed.widgetId)
    if (existing) {
      clearTimeout(existing)
    }
    const timer = setTimeout(() => {
      this.resizeTimers.delete(managed.widgetId)
      if (managed.win.isDestroyed()) {
        return
      }
      const [width, height] = managed.win.getContentSize()
      managed.win.webContents.send(IPC.widgetEvent, {
        event: 'resize',
        data: { width, height }
      })
    }, 100)
    this.resizeTimers.set(managed.widgetId, timer)
  }

  private handleWidgetFailure(managed: ManagedWidget, label: string): void {
    if (this.reloading.has(managed.widgetId)) {
      return
    }
    const now = Date.now()
    const times = (this.failures.get(managed.widgetId) ?? []).filter(
      (time) => now - time < WIDGET_CRASH_WINDOW_MS
    )
    times.push(now)
    this.failures.set(managed.widgetId, times)

    if (times.length > WIDGET_CRASH_LIMIT) {
      this.clearAutoReload(managed.widgetId)
      this.disableWidget(managed.widgetId, t('widgets.crashReason', { count: times.length }))
      return
    }

    this.showBadge(managed, label)
    if (label === 'crashed' && !this.autoReloadTimers.has(managed.widgetId)) {
      const timer = setTimeout(() => {
        this.autoReloadTimers.delete(managed.widgetId)
        if (this.managed.get(managed.widgetId) === managed && !managed.win.isDestroyed()) {
          this.reloadWidget(managed.widgetId)
        }
      }, 1_500)
      this.autoReloadTimers.set(managed.widgetId, timer)
    }
  }

  private clearAutoReload(widgetId: string): void {
    const timer = this.autoReloadTimers.get(widgetId)
    if (timer) {
      clearTimeout(timer)
      this.autoReloadTimers.delete(widgetId)
    }
  }

  private showBadge(managed: ManagedWidget, label: string): void {
    if (this.badges.has(managed.widgetId) || managed.win.isDestroyed()) {
      return
    }

    const badge = createWidgetBadge({
      bounds: managed.win.getBounds(),
      title: label === 'crashed' ? 'Widget crashed' : 'Widget not responding'
    })
    const senderId = badge.window.webContents.id
    this.badges.set(managed.widgetId, badge)
    this.badgeSenders.set(senderId, managed.widgetId)

    badge.window.on('closed', () => {
      if (this.badges.get(managed.widgetId) === badge) {
        this.badges.delete(managed.widgetId)
      }
      this.badgeSenders.delete(senderId)
    })
  }

  private destroyBadge(widgetId: string): void {
    const badge = this.badges.get(widgetId)
    if (!badge) {
      return
    }
    this.badges.delete(widgetId)
    for (const [senderId, id] of this.badgeSenders) {
      if (id === widgetId) {
        this.badgeSenders.delete(senderId)
      }
    }
    badge.destroy()
  }

  private disableWidget(widgetId: string, reason: string): void {
    const manifest = this.widgetService.getManifest(widgetId)
    const placement = this.widgetService.updatePlacement(widgetId, { enabled: false })
    if (!placement) {
      return
    }

    this.disabledReasons.set(widgetId, reason)
    this.notices.add(
      'error',
      t('widgets.disabledNotice', { name: manifest?.name ?? widgetId, reason })
    )
    this.detach(widgetId)
    this.emitChanged()
  }

  private detach(widgetId: string): void {
    const managed = this.managed.get(widgetId)
    this.clearAutoReload(widgetId)
    this.destroyBadge(widgetId)
    this.failures.delete(widgetId)
    const resizeTimer = this.resizeTimers.get(widgetId)
    if (resizeTimer) {
      clearTimeout(resizeTimer)
      this.resizeTimers.delete(widgetId)
    }
    if (!managed) {
      return
    }
    this.managed.delete(widgetId)
    if (this.pointer?.widgetId === widgetId) {
      this.clearPointer()
    }
    if (!managed.win.isDestroyed()) {
      managed.win.destroy()
    }
  }

  private pinWindow(managed: ManagedWidget, reason: string): void {
    if (managed.win.isDestroyed()) {
      return
    }
    if (!this.pinResolved) {
      this.pinResolved = logPinStrategy()
    }

    try {
      const hwnd = nativeWindowHandle(managed.win)
      const ok = pinWithFallback(hwnd, this.pinResolved.strategy, this.pinResolved.auto)
      const data = {
        window: managed.win.id,
        widget: managed.widgetId,
        hwnd: `0x${hwnd.toString(16)}`,
        strategy: this.pinResolved.strategy,
        reason,
        ok
      }
      if (reason === 'show') {
        log.info('Widget pinned', data)
      } else {
        log.debug('Widget re-pinned', data)
      }
    } catch (error) {
      log.error('Widget pin failed', { widget: managed.widgetId, reason, error })
    }
  }

  private repinAll(reason: string): void {
    for (const managed of this.managed.values()) {
      if (managed.win.isDestroyed()) {
        continue
      }
      this.pinWindow(managed, reason)
    }
  }

  private stopForegroundBurst(): void {
    if (this.foregroundBurstTimer) {
      clearInterval(this.foregroundBurstTimer)
      this.foregroundBurstTimer = null
    }
    if (this.foregroundBurstStop) {
      clearTimeout(this.foregroundBurstStop)
      this.foregroundBurstStop = null
    }
  }

  private readonly handleForegroundChange = (): void => {
    this.stopForegroundBurst()
    this.repinAll('foreground')
    this.foregroundBurstTimer = setInterval(
      () => this.repinAll('foreground'),
      WIDGET_FOREGROUND_REPIN_INTERVAL_MS
    )
    this.foregroundBurstStop = setTimeout(() => {
      this.stopForegroundBurst()
      this.repinAll('foreground')
    }, WIDGET_FOREGROUND_REPIN_MS)
  }

  private readonly handleWake = (): void => {
    this.repinAll('wake')
    void this.relayout().then(() => this.repinAll('wake'))
  }

  private readonly handleDisplayChange = (): void => {
    if (this.displayDebounce) {
      clearTimeout(this.displayDebounce)
    }
    this.displayDebounce = setTimeout(() => {
      this.displayDebounce = null
      if (this.pointer) {
        this.finishPointer(true)
      }
      void this.relayout().then(() => this.repinAll('display'))
    }, 500)
  }

  private async relayout(): Promise<void> {
    const placements = new Map(
      this.widgetService.listPlacements().map((placement) => [placement.widgetId, placement])
    )

    for (const managed of [...this.managed.values()]) {
      const placement = placements.get(managed.widgetId)
      if (!placement || !placement.enabled) {
        this.detach(managed.widgetId)
        continue
      }
      this.syncWindow(managed, placement)
    }

    for (const placement of placements.values()) {
      if (!placement.enabled || this.managed.has(placement.widgetId)) {
        continue
      }
      const manifest = this.widgetService.getManifest(placement.widgetId)
      if (manifest) {
        await this.openWidget(manifest, placement)
      }
    }
  }

  private emitChanged(): void {
    for (const listener of this.changeListeners) {
      listener()
    }
  }
}
