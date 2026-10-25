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
import { findBuiltin } from '../../shared/builtins'
import {
  CLOCK_WIDGET_ID,
  MAGNETISM_DIP,
  MIN_VISIBLE_DIP,
  SNAP_STEP_DIP,
  WIDGET_CASCADE_OFFSET_DIP,
  WIDGET_DRAG_INTERVAL_MS,
  WIDGET_DRAG_WATCHDOG_MS,
  WIDGET_PIN_INTERVAL_MS
} from '../../shared/constants'
import { IPC } from '../../shared/ipc'
import type {
  BuiltinWidget,
  ShellState,
  WidgetManifest,
  WidgetPlacement,
  WidgetSummary
} from '../../shared/types'
import { getEditMode, setEditMode } from '../services/edit-mode'
import log from '../services/logger'
import type { NoticeService } from '../services/notices'
import type { WidgetService } from '../services/widget-service'
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
import { createWidgetWindow, loadWidgetShell } from './widget-window'

export interface LayoutServiceOptions {
  widgetService: WidgetService
  notices: NoticeService
  safe: boolean
}

interface ManagedWidget {
  widgetId: string
  manifest: WidgetManifest
  win: BrowserWindow
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
  private readonly managed = new Map<string, ManagedWidget>()
  private readonly changeListeners = new Set<() => void>()
  private pointer: PointerState | null = null
  private maintenanceTimer: NodeJS.Timeout | null = null
  private displayDebounce: NodeJS.Timeout | null = null
  private pinResolved: ResolvedPinStrategy | null = null
  private started = false

  constructor(options: LayoutServiceOptions) {
    this.widgetService = options.widgetService
    this.notices = options.notices
    this.safe = options.safe
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
  }

  stop(): void {
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

  async addWidget(builtinType: string): Promise<WidgetSummary> {
    if (this.safe) {
      throw new Error('Safe mode is enabled')
    }

    const builtin = findBuiltin(builtinType)
    if (!builtin) {
      throw new Error(`Unknown widget type: ${builtinType}`)
    }

    const placement = this.nextPlacement(builtin)
    const summary = await this.widgetService.create(builtin, placement)
    await this.openWidget(summary.manifest, summary.placement)
    this.emitChanged()
    return summary
  }

  async removeWidget(widgetId: string, parent: BrowserWindow | null): Promise<boolean> {
    const managed = this.managed.get(widgetId)
    const manifest = managed?.manifest ?? this.widgetService.getManifest(widgetId)
    if (!manifest || !this.widgetService.getPlacement(widgetId)) {
      return false
    }

    const options = {
      type: 'warning' as const,
      buttons: ['Cancel', 'Remove'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: `Remove ${manifest.name}`,
      message: `Remove "${manifest.name}" from the desktop?`,
      detail: 'Built-in widget files stay on disk.'
    }
    const result =
      parent && !parent.isDestroyed()
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options)
    if (result.response !== 1) {
      return false
    }

    this.detach(widgetId)
    await this.widgetService.remove(widgetId, manifest.kind !== 'builtin')
    this.emitChanged()
    return true
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
    if (managed && !managed.win.isDestroyed()) {
      managed.win.setOpacity(placement.opacity)
      this.sendState(managed)
    }
    this.emitChanged()
    return true
  }

  reloadWidget(widgetId: string): void {
    const managed = this.managed.get(widgetId)
    if (managed && !managed.win.isDestroyed()) {
      managed.win.webContents.reload()
    }
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

  private nextPlacement(builtin: BuiltinWidget): Omit<WidgetPlacement, 'widgetId'> {
    const display = toDisplayLike(screen.getPrimaryDisplay())
    const count = this.widgetService.listPlacements().length
    const bounds = centerBounds(
      display.workArea,
      { width: builtin.width, height: builtin.height },
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

  private async openWidget(manifest: WidgetManifest, placement: WidgetPlacement): Promise<void> {
    const existing = this.managed.get(manifest.id)
    if (existing) {
      this.syncWindow(existing, placement)
      return
    }

    const display = this.resolveDisplay(placement)
    const effective = clampPlacement(placement, display, MIN_VISIBLE_DIP)
    const bounds = boundsForPlacement(effective, display)
    const win = createWidgetWindow({
      widgetId: manifest.id,
      title: manifest.name,
      bounds,
      opacity: effective.opacity
    })
    const managed: ManagedWidget = {
      widgetId: manifest.id,
      manifest,
      win
    }
    this.managed.set(manifest.id, managed)

    win.on('show', () => this.pinWindow(managed, 'show'))
    win.on('closed', () => {
      if (this.pointer?.widgetId === manifest.id) {
        this.clearPointer()
      }
      if (this.managed.get(manifest.id) === managed) {
        this.managed.delete(manifest.id)
      }
    })
    win.webContents.on('context-menu', () => {
      if (!getEditMode()) {
        this.showContextMenu(managed)
      }
    })

    try {
      await loadWidgetShell(win, manifest.id)
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
    const effective = clampPlacement(placement, display, MIN_VISIBLE_DIP)
    managed.win.setBounds(boundsForPlacement(effective, display))
    managed.win.setOpacity(effective.opacity)
    managed.manifest = this.widgetService.getManifest(managed.widgetId) ?? managed.manifest
    this.sendState(managed)
  }

  private resolveDisplay(placement: WidgetPlacement): DisplayLike {
    const primary = toDisplayLike(screen.getPrimaryDisplay())
    const displays = screen.getAllDisplays().map(toDisplayLike)
    return displayForPlacement(placement, displays, primary)
  }

  private stateFor(managed: ManagedWidget): ShellState {
    const placement = this.widgetService.getPlacement(managed.widgetId)
    return {
      widgetId: managed.widgetId,
      editMode: getEditMode(),
      locked: placement?.locked ?? false,
      opacity: placement?.opacity ?? 1
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
    const minWidth = Math.max(1, managed.manifest.minWidth ?? 120)
    const minHeight = Math.max(1, managed.manifest.minHeight ?? 80)
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
    const minWidth = Math.max(1, managed.manifest.minWidth ?? 120)
    const minHeight = Math.max(1, managed.manifest.minHeight ?? 80)
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
      { label: 'Edit layout', click: () => setEditMode(true) },
      { type: 'separator' },
      {
        label: placement.locked ? 'Unlock widget' : 'Lock widget',
        click: () => this.setLocked(managed.widgetId, !placement.locked)
      },
      { label: 'Opacity', submenu: opacityItems },
      { type: 'separator' },
      { label: 'Reload widget', click: () => this.reloadWidget(managed.widgetId) },
      {
        label: 'Remove widget',
        click: () => {
          void this.removeWidget(managed.widgetId, managed.win)
        }
      }
    ]

    Menu.buildFromTemplate(template).popup({ window: managed.win })
  }

  private detach(widgetId: string): void {
    const managed = this.managed.get(widgetId)
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
