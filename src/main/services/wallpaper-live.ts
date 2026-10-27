import { powerMonitor, screen, type Display } from 'electron'
import { basename } from 'node:path'
import { IPC } from '../../shared/ipc'
import type { WallpaperHostEvent, WallpaperItem, WallpaperState } from '../../shared/types'
import { isLiveWallpaperFit } from '../../shared/wallpaper-fit'
import { getFullscreenSignal } from '../native/fullscreen'
import {
  attachToDesktop,
  desktopIsAvailable,
  desktopParentFor,
  wallpaperWindowIsAttached,
  type WallpaperStrategy
} from '../native/wallpaper-attach'
import {
  createWallpaperWindow,
  loadWallpaperHost,
  nativeWindowHandle,
  setWallpaperWindowBounds,
  type WallpaperWindow
} from '../windows/wallpaper-window'
import log from './logger'
import type { NoticeService } from './notices'
import {
  decideWallpaperPause,
  normalizeCursorPoint,
  type WallpaperPauseDecision
} from './wallpaper-live-policy'
import type { WallpaperService } from './wallpaper-service'

export interface WallpaperLiveServiceOptions {
  service: WallpaperService
  strategy: WallpaperStrategy
  safe?: boolean
  notices?: NoticeService
  pollIntervalMs?: number
  recoveryIntervalMs?: number
  mouseIntervalMs?: number
  loginWaitMs?: number
}

interface LiveWindow extends WallpaperWindow {
  bounds: Display['bounds']
}

const DEFAULT_POLL_MS = 2000
const DEFAULT_RECOVERY_MS = 3000
const DEFAULT_MOUSE_MS = 33
const DEFAULT_LOGIN_WAIT_MS = 30_000
const LOAD_TIMEOUT_MS = 15_000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}

function sameBounds(a: Display['bounds'], b: Display['bounds']): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

export class WallpaperLiveService {
  private readonly service: WallpaperService
  private readonly strategy: WallpaperStrategy
  private readonly safe: boolean
  private readonly notices: NoticeService | null
  private readonly pollIntervalMs: number
  private readonly recoveryIntervalMs: number
  private readonly mouseIntervalMs: number
  private readonly loginWaitMs: number

  private readonly windows = new Map<number, LiveWindow>()
  private currentKey = ''
  private currentItem: WallpaperItem | null = null
  private currentState: WallpaperState | null = null
  private paused = false
  private userPaused = false
  private suspended = false
  private locked = false
  private destroyed = false
  private syncing = false
  private syncQueued = false
  private unsubscribe: (() => void) | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private recoveryTimer: ReturnType<typeof setInterval> | null = null
  private mouseTimer: ReturnType<typeof setInterval> | null = null
  private lastMouseKey = ''
  private failureNotified = false
  private readonly listeners: Array<() => void> = []

  constructor(options: WallpaperLiveServiceOptions) {
    this.service = options.service
    this.strategy = options.strategy
    this.safe = options.safe ?? false
    this.notices = options.notices ?? null
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_MS
    this.recoveryIntervalMs = options.recoveryIntervalMs ?? DEFAULT_RECOVERY_MS
    this.mouseIntervalMs = options.mouseIntervalMs ?? DEFAULT_MOUSE_MS
    this.loginWaitMs = options.loginWaitMs ?? DEFAULT_LOGIN_WAIT_MS
  }

  start(): void {
    if (this.destroyed || this.safe || process.platform !== 'win32') {
      return
    }

    this.unsubscribe = this.service.onChanged(() => {
      void this.sync()
    })

    const onDisplaysChanged = (): void => {
      this.closeAllWindows()
      void this.sync()
    }
    screen.on('display-added', onDisplaysChanged)
    screen.on('display-removed', onDisplaysChanged)
    screen.on('display-metrics-changed', onDisplaysChanged)
    this.listeners.push(() => {
      screen.removeListener('display-added', onDisplaysChanged)
      screen.removeListener('display-removed', onDisplaysChanged)
      screen.removeListener('display-metrics-changed', onDisplaysChanged)
    })

    const onSuspend = (): void => {
      this.suspended = true
      this.applyPause(true)
    }
    const onResume = (): void => {
      this.suspended = false
      this.applyPause(true)
      void this.sync()
    }
    const onLock = (): void => {
      this.locked = true
      this.applyPause(true)
    }
    const onUnlock = (): void => {
      this.locked = false
      this.applyPause(true)
      void this.sync()
    }
    powerMonitor.on('suspend', onSuspend)
    powerMonitor.on('resume', onResume)
    powerMonitor.on('lock-screen', onLock)
    powerMonitor.on('unlock-screen', onUnlock)
    this.listeners.push(() => {
      powerMonitor.removeListener('suspend', onSuspend)
      powerMonitor.removeListener('resume', onResume)
      powerMonitor.removeListener('lock-screen', onLock)
      powerMonitor.removeListener('unlock-screen', onUnlock)
    })

    this.pollTimer = setInterval(() => this.poll(), this.pollIntervalMs)
    this.recoveryTimer = setInterval(() => {
      void this.recover().catch((error) => {
        log.warn('Live wallpaper recovery failed', error)
      })
    }, this.recoveryIntervalMs)
    this.mouseTimer = setInterval(() => this.forwardMouse(), this.mouseIntervalMs)

    void this.waitForDesktop()
      .then(() => this.sync())
      .catch((error) => {
        log.warn('Live wallpaper desktop wait failed', error)
      })
  }

  stop(): void {
    this.destroyed = true
    this.unsubscribe?.()
    this.unsubscribe = null
    for (const remove of this.listeners.splice(0)) {
      remove()
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer)
      this.recoveryTimer = null
    }
    if (this.mouseTimer) {
      clearInterval(this.mouseTimer)
      this.mouseTimer = null
    }
    this.closeAllWindows()
    this.currentKey = ''
    this.currentItem = null
    this.currentState = null
  }

  isUserPaused(): boolean {
    return this.userPaused
  }

  setUserPaused(paused: boolean): void {
    if (this.userPaused === paused) {
      return
    }
    this.userPaused = paused
    this.applyPause(true)
  }

  toggleUserPaused(): boolean {
    this.setUserPaused(!this.userPaused)
    return this.userPaused
  }

  private async waitForDesktop(): Promise<void> {
    const deadline = Date.now() + this.loginWaitMs
    while (!this.destroyed && Date.now() < deadline) {
      if (desktopIsAvailable()) {
        return
      }
      await delay(1000)
    }
    if (!this.destroyed) {
      log.warn('Desktop layer was not ready after login; live wallpaper will keep retrying')
    }
  }

  private async sync(): Promise<void> {
    if (this.destroyed) {
      return
    }
    if (this.syncing) {
      this.syncQueued = true
      return
    }

    this.syncing = true
    try {
      await this.syncNow()
    } catch (error) {
      log.warn('Live wallpaper sync failed', error)
    } finally {
      this.syncing = false
      if (this.syncQueued) {
        this.syncQueued = false
        void this.sync()
      }
    }
  }

  private async syncNow(): Promise<void> {
    const state = this.service.getState()
    this.currentState = state
    const item =
      state.config.mode === 'live' && state.config.currentId
        ? (state.items.find((candidate) => candidate.id === state.config.currentId) ?? null)
        : null

    if (!item || item.type === 'image') {
      this.closeAllWindows()
      this.currentKey = ''
      this.currentItem = null
      return
    }

    const key = `${item.id}|${item.file}|${item.type}|${item.fit}|${item.interactive === true}|${state.config.videoMuted}`
    if (key !== this.currentKey) {
      this.closeAllWindows()
      this.currentKey = ''
      this.currentItem = item
      await this.service.applyStaticFallback(item)
      await this.ensureDisplays(item, state)
      if (this.windows.size > 0) {
        this.currentKey = key
      }
    } else {
      this.currentItem = item
      await this.ensureDisplays(item, state)
    }

    this.applyPause(true)
    this.forwardMouse()
  }

  private async ensureDisplays(item: WallpaperItem, state: WallpaperState): Promise<void> {
    const displays = screen.getAllDisplays()
    const active = new Set(displays.map((display) => display.id))
    for (const entry of [...this.windows.values()]) {
      if (!active.has(entry.displayId) || entry.win.isDestroyed()) {
        this.closeWindow(entry)
      }
    }

    for (const display of displays) {
      const existing = this.windows.get(display.id)
      if (!existing) {
        await this.buildWindow(display, item, state)
        continue
      }
      if (!sameBounds(existing.bounds, display.bounds)) {
        existing.bounds = { ...display.bounds }
        setWallpaperWindowBounds(existing.win, display)
        try {
          const rect = screen.dipToScreenRect(existing.win, display.bounds)
          const attach = await attachToDesktop(existing.hwnd, rect, this.strategy)
          existing.parent = attach.parent
          existing.strategy = attach.strategy
        } catch (error) {
          log.warn('Could not reattach the live wallpaper after a display change', error)
          this.closeWindow(existing)
        }
      }
    }
  }

  private async buildWindow(
    display: Display,
    item: WallpaperItem,
    state: WallpaperState
  ): Promise<boolean> {
    const win = createWallpaperWindow(display)
    try {
      await withTimeout(
        loadWallpaperHost(win, {
          type: item.type === 'video' ? 'video' : 'html',
          src: this.hostSource(item),
          fit: isLiveWallpaperFit(item.fit) ? item.fit : 'fill',
          muted: state.config.videoMuted
        }),
        LOAD_TIMEOUT_MS,
        'Timed out loading the live wallpaper host'
      )
      const hwnd = nativeWindowHandle(win)
      const rect = screen.dipToScreenRect(win, display.bounds)
      const attach = await attachToDesktop(hwnd, rect, this.strategy)
      win.showInactive()
      this.windows.set(display.id, {
        win,
        displayId: display.id,
        hwnd,
        parent: attach.parent,
        strategy: attach.strategy,
        bounds: { ...display.bounds }
      })
      this.failureNotified = false
      log.info('Live wallpaper attached', {
        id: item.id,
        display: display.id,
        strategy: attach.strategy,
        parent: `0x${attach.parent.toString(16)}`
      })
      return true
    } catch (error) {
      log.warn('Could not attach the live wallpaper window', {
        id: item.id,
        display: display.id,
        error
      })
      if (!this.failureNotified) {
        this.failureNotified = true
        this.notices?.add(
          'warning',
          'The live wallpaper could not attach to the desktop. The static fallback remains active while HomeLayer retries.'
        )
      }
      if (!win.isDestroyed()) {
        win.destroy()
      }
      return false
    }
  }

  private hostSource(item: WallpaperItem): string {
    if (item.type === 'video') {
      return `hl-wallpaper://media/${item.id}/${encodeURIComponent(basename(item.file))}`
    }
    return `widget://wp-${item.id}/index.html`
  }

  private poll(): void {
    if (this.destroyed || this.windows.size === 0) {
      return
    }
    this.applyPause()
    this.forwardMouse()
  }

  private async recover(): Promise<void> {
    if (this.destroyed || this.syncing) {
      return
    }
    if (!this.currentState || this.currentState.config.mode !== 'live') {
      return
    }
    if (!desktopIsAvailable()) {
      return
    }
    if (this.windows.size === 0) {
      await this.sync()
      return
    }

    for (const entry of [...this.windows.values()]) {
      if (entry.win.isDestroyed()) {
        this.closeWindow(entry)
        await this.sync()
        return
      }
      const parent = desktopParentFor(entry.strategy)
      if (!parent) {
        log.warn('Live wallpaper desktop layout changed; rebuilding', {
          display: entry.displayId,
          strategy: entry.strategy
        })
        this.closeAllWindows()
        await this.sync()
        return
      }
      if (!wallpaperWindowIsAttached(entry.hwnd, parent)) {
        log.warn('Live wallpaper lost its desktop parent; rebuilding', {
          display: entry.displayId,
          strategy: entry.strategy
        })
        this.closeAllWindows()
        await this.sync()
        return
      }
    }

    const activeDisplays = new Set(screen.getAllDisplays().map((display) => display.id))
    const hasInactiveWindow = [...this.windows.keys()].some((id) => !activeDisplays.has(id))
    if (hasInactiveWindow || this.windows.size !== activeDisplays.size) {
      await this.sync()
    }
  }

  private applyPause(force = false): void {
    if (!this.currentState || this.currentState.config.mode !== 'live' || this.windows.size === 0) {
      return
    }

    let notificationState: number | null = null
    let foregroundFullscreen = false
    try {
      const signal = getFullscreenSignal()
      notificationState = signal.notificationState
      foregroundFullscreen = signal.foregroundFullscreen
    } catch (error) {
      log.warn('Could not read the fullscreen pause signal', error)
    }

    const decision: WallpaperPauseDecision = decideWallpaperPause({
      notificationState,
      foregroundFullscreen,
      onBattery: powerMonitor.isOnBatteryPower(),
      pauseOnBattery: this.currentState.config.pauseOnBattery,
      locked: this.locked,
      suspended: this.suspended,
      userPaused: this.userPaused
    })

    if (!force && decision.paused === this.paused) {
      return
    }
    this.paused = decision.paused
    this.lastMouseKey = ''
    this.sendHostEvent({ type: 'pause', paused: this.paused })
    log.info('Live wallpaper pause changed', {
      paused: this.paused,
      reasons: decision.reasons
    })
  }

  private forwardMouse(): void {
    if (
      this.destroyed ||
      this.paused ||
      !this.currentItem ||
      this.currentItem.type !== 'html' ||
      this.currentItem.interactive !== true ||
      this.windows.size === 0
    ) {
      this.lastMouseKey = ''
      return
    }

    const point = screen.getCursorScreenPoint()
    let hovered: {
      entry: LiveWindow
      x: number
      y: number
      normalized: { x: number; y: number }
    } | null = null
    for (const entry of this.windows.values()) {
      if (entry.win.isDestroyed()) {
        continue
      }
      const bounds = entry.bounds
      if (
        point.x >= bounds.x &&
        point.y >= bounds.y &&
        point.x < bounds.x + bounds.width &&
        point.y < bounds.y + bounds.height
      ) {
        const normalized = normalizeCursorPoint(point, bounds)
        hovered = {
          entry,
          x: Math.round(normalized.x * Math.max(0, bounds.width - 1)),
          y: Math.round(normalized.y * Math.max(0, bounds.height - 1)),
          normalized
        }
        break
      }
    }

    if (!hovered) {
      this.lastMouseKey = ''
      return
    }

    const { entry, x, y, normalized } = hovered
    const key = `${entry.displayId}:${x}:${y}`
    if (key !== this.lastMouseKey) {
      this.lastMouseKey = key
      try {
        entry.win.webContents.send(IPC.wallpaperHostEvent, {
          type: 'mouse',
          x: normalized.x,
          y: normalized.y
        })
        entry.win.webContents.sendInputEvent({ type: 'mouseMove', x, y })
      } catch (error) {
        log.debug('Could not forward mouse movement to the live wallpaper', error)
      }
    }
  }

  private sendHostEvent(event: WallpaperHostEvent): void {
    for (const entry of this.windows.values()) {
      if (!entry.win.isDestroyed()) {
        try {
          entry.win.webContents.send(IPC.wallpaperHostEvent, event)
        } catch (error) {
          log.debug('Could not send a host event to the live wallpaper', error)
        }
      }
    }
  }

  private closeWindow(entry: LiveWindow): void {
    if (!entry.win.isDestroyed()) {
      entry.win.destroy()
    }
    this.windows.delete(entry.displayId)
  }

  private closeAllWindows(): void {
    for (const entry of [...this.windows.values()]) {
      this.closeWindow(entry)
    }
    this.lastMouseKey = ''
  }
}
