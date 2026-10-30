import { app, BrowserWindow, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import {
  BUNDLE_POPOVER_CLOSE_GRACE_MS,
  BUNDLE_POPOVER_HEADER_HEIGHT,
  BUNDLE_POPOVER_MAX_ROWS,
  BUNDLE_POPOVER_ROW_HEIGHT,
  BUNDLE_POPOVER_WIDTH
} from '../../shared/constants'
import { IPC } from '../../shared/ipc'
import type { BundlePopoverResult, BundlePopoverState } from '../../shared/types'
import { t } from '../i18n'
import type { AppGridService } from '../services/app-grid-service'
import type { AppLauncher } from '../services/app-launcher'
import { WidgetApiError } from '../services/widget-api-error'
import log from '../services/logger'

export interface PopoverAnchor {
  x: number
  y: number
  width: number
  height: number
  variant?: string
}

export interface OpenPopoverOptions {
  widgetId: string
  bundleId: string
  rect: PopoverAnchor
  sender: WebContents
  placement?: 'center' | 'above' | 'below'
}

interface PopoverSession {
  widgetId: string
  bundleId: string
  win: BrowserWindow
  openedAt: number
}

function popoverHeight(appCount: number): number {
  const rows = Math.min(BUNDLE_POPOVER_MAX_ROWS, Math.max(1, Math.ceil(Math.max(1, appCount) / 3)))
  return BUNDLE_POPOVER_HEADER_HEIGHT + rows * BUNDLE_POPOVER_ROW_HEIGHT + 16
}

function clampToWorkArea(
  rect: { x: number; y: number; width: number; height: number },
  workArea: { x: number; y: number; width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const width = Math.min(rect.width, workArea.width)
  const height = Math.min(rect.height, workArea.height)
  return {
    x: Math.round(Math.min(Math.max(rect.x, workArea.x), workArea.x + workArea.width - width)),
    y: Math.round(Math.min(Math.max(rect.y, workArea.y), workArea.y + workArea.height - height)),
    width: Math.round(width),
    height: Math.round(height)
  }
}

export class BundlePopoverService {
  private readonly appGrid: AppGridService
  private readonly launcher: AppLauncher
  private readonly onChanged: ((widgetId: string) => void) | undefined
  private current: PopoverSession | null = null

  constructor(options: {
    appGrid: AppGridService
    launcher: AppLauncher
    onChanged?: (widgetId: string) => void
  }) {
    this.appGrid = options.appGrid
    this.launcher = options.launcher
    this.onChanged = options.onChanged
  }

  async open(options: OpenPopoverOptions): Promise<void> {
    const state = this.appGrid.bundleState(options.widgetId, options.bundleId)
    if (!state) {
      throw new WidgetApiError('not_found', 'bundle not found')
    }

    const widgetWindow = BrowserWindow.fromWebContents(options.sender)
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      throw new WidgetApiError('not_found', 'widget window not found')
    }

    if (this.current) {
      if (
        this.current.widgetId === options.widgetId &&
        this.current.bundleId === options.bundleId &&
        !this.current.win.isDestroyed()
      ) {
        this.position(this.current.win, widgetWindow, options.rect, state, options.placement)
        this.current.openedAt = Date.now()
        this.current.win.show()
        this.current.win.focus()
        this.sendState(this.current, state)
        return
      }
      this.close()
    }

    const height = popoverHeight(state.bundle.apps.length)
    const win = new BrowserWindow({
      width: BUNDLE_POPOVER_WIDTH,
      height,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      hasShadow: false,
      title: t('popover.bundle'),
      webPreferences: {
        preload: join(__dirname, '../preload/bundle-preload.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
        spellcheck: false
      }
    })

    const session: PopoverSession = {
      widgetId: options.widgetId,
      bundleId: options.bundleId,
      win,
      openedAt: Date.now()
    }
    this.current = session

    win.setMenu(null)
    win.setAlwaysOnTop(true, 'pop-up-menu')
    win.setSkipTaskbar(true)
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event) => event.preventDefault())
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        event.preventDefault()
        this.close()
      }
    })
    win.on('blur', () => {
      if (this.current !== session) {
        return
      }
      if (Date.now() - session.openedAt < BUNDLE_POPOVER_CLOSE_GRACE_MS) {
        return
      }
      this.close()
    })
    win.on('closed', () => {
      if (this.current === session) {
        this.current = null
      }
    })
    win.on('unresponsive', () => this.close())
    widgetWindow.once('closed', () => {
      if (this.current === session) {
        this.close()
      }
    })

    this.position(win, widgetWindow, options.rect, state, options.placement)
    win.once('ready-to-show', () => {
      if (this.current !== session) {
        return
      }
      session.openedAt = Date.now()
      win.show()
      win.focus()
    })

    try {
      const query: Record<string, string> = {
        widgetId: options.widgetId,
        bundleId: options.bundleId
      }
      if (options.rect.variant) {
        query['variant'] = options.rect.variant
      }
      await win.loadFile(
        join(app.getAppPath(), 'resources', 'builtin-widgets', 'app-grid', 'popover.html'),
        { query }
      )
    } catch (error) {
      log.error('Could not load bundle popover', error)
      this.close()
      throw new WidgetApiError('internal', 'could not open the bundle')
    }
  }

  stateForSender(sender: WebContents): BundlePopoverState | null {
    const session = this.sessionForSender(sender)
    return session ? this.appGrid.bundleState(session.widgetId, session.bundleId) : null
  }

  renameForSender(sender: WebContents, name: string): BundlePopoverResult {
    const session = this.requireSession(sender)
    this.appGrid.renameBundle(session.widgetId, session.bundleId, name)
    return this.afterChange(session)
  }

  removeAppForSender(sender: WebContents, appId: string): BundlePopoverResult {
    const session = this.requireSession(sender)
    const result = this.appGrid.removeAppFromBundle(session.widgetId, session.bundleId, appId)
    this.notifyChanged(session)
    if (result.dissolved) {
      this.sendState(session, null)
      this.close()
      return result
    }
    this.sendState(session, result.state)
    return result
  }

  reorderForSender(sender: WebContents, from: number, to: number): BundlePopoverResult {
    const session = this.requireSession(sender)
    const result = this.appGrid.reorderBundle(session.widgetId, session.bundleId, from, to)
    this.notifyChanged(session)
    this.sendState(session, result.state)
    return result
  }

  async launchForSender(sender: WebContents, appId: string): Promise<void> {
    const session = this.requireSession(sender)
    if (!this.appGrid.appIdsInBundle(session.widgetId, session.bundleId).includes(appId)) {
      throw new WidgetApiError('not_found', 'app is not in this bundle')
    }
    await this.launcher.launch(appId)
  }

  closeForSender(sender: WebContents): void {
    const session = this.sessionForSender(sender)
    if (session) {
      this.close()
    }
  }

  closeForWidget(widgetId: string): void {
    if (this.current?.widgetId === widgetId) {
      this.close()
    }
  }

  close(): void {
    const session = this.current
    this.current = null
    if (session && !session.win.isDestroyed()) {
      session.win.destroy()
    }
  }

  private afterChange(session: PopoverSession): BundlePopoverResult {
    this.notifyChanged(session)
    const state = this.appGrid.bundleState(session.widgetId, session.bundleId)
    if (!state) {
      this.sendState(session, null)
      this.close()
      return { state: null, dissolved: true }
    }
    this.sendState(session, state)
    return { state, dissolved: false }
  }

  private notifyChanged(session: PopoverSession): void {
    this.onChanged?.(session.widgetId)
  }

  private sessionForSender(sender: WebContents): PopoverSession | null {
    return this.current && this.current.win.webContents === sender ? this.current : null
  }

  private requireSession(sender: WebContents): PopoverSession {
    const session = this.sessionForSender(sender)
    if (!session) {
      throw new WidgetApiError('permission_denied', 'unknown bundle popover sender')
    }
    return session
  }

  private position(
    win: BrowserWindow,
    widgetWindow: BrowserWindow,
    rect: PopoverAnchor,
    state: BundlePopoverState,
    placement: 'center' | 'above' | 'below' = 'center'
  ): void {
    const widgetBounds = widgetWindow.getContentBounds()
    const anchor = {
      x: widgetBounds.x + rect.x,
      y: widgetBounds.y + rect.y,
      width: rect.width,
      height: rect.height
    }
    const height = popoverHeight(state.bundle.apps.length)
    const x = anchor.x + anchor.width / 2 - BUNDLE_POPOVER_WIDTH / 2
    const y =
      placement === 'above'
        ? anchor.y - height - 8
        : placement === 'below'
          ? anchor.y + anchor.height + 8
          : anchor.y + anchor.height / 2 - height / 2
    const size = {
      x,
      y,
      width: BUNDLE_POPOVER_WIDTH,
      height
    }
    const display = screen.getDisplayMatching({
      x: Math.round(anchor.x),
      y: Math.round(anchor.y),
      width: Math.max(1, Math.round(anchor.width)),
      height: Math.max(1, Math.round(anchor.height))
    })
    win.setBounds(clampToWorkArea(size, display.workArea))
  }

  private sendState(session: PopoverSession, state: BundlePopoverState | null): void {
    if (!session.win.isDestroyed()) {
      session.win.webContents.send(IPC.bundleStateChanged, state)
    }
  }
}
