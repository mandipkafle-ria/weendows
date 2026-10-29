import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { resolveWidgetAppearance } from '../../shared/appearance'
import { findBuiltin } from '../../shared/builtins'
import { MIN_VISIBLE_DIP, SNAP_STEP_DIP } from '../../shared/constants'
import { effectiveMinSize } from '../../shared/widget-size'
import type {
  DesktopDisplayInfo,
  GeneralState,
  WallpaperState,
  WidgetBoundsPatch,
  WidgetPermission,
  WidgetRuntimeInfo,
  WidgetSummary
} from '../../shared/types'
import { t } from '../i18n'
import type { ToastLevel } from './useToasts'
import WidgetPreview from './WidgetPreview'
import { previewSourceFor } from './widgetPreviewMeta'

interface DesktopCanvasProps {
  widgets: WidgetSummary[]
  general: GeneralState
  runtimeById: Map<string, WidgetRuntimeInfo>
  pending: string | null
  onRefresh: () => Promise<void>
  onCustomize: (widget: WidgetSummary) => void
  onVariant: (widget: WidgetSummary, variantId: string) => void
  onTheme: (widget: WidgetSummary, value: string) => void
  onOpacity: (widget: WidgetSummary, opacity: number) => void
  onToggleEnabled: (widget: WidgetSummary, enabled: boolean) => void
  onToggleLocked: (widget: WidgetSummary) => void
  onDuplicate: (widgetId: string) => void
  onReload: (widgetId: string) => void
  onRemove: (widgetId: string) => void
  onPermission: (widget: WidgetSummary, permission: WidgetPermission, granted: boolean) => void
  onEditWithAi: (widgetId: string) => void
  toast: (message: string, level?: ToastLevel) => void
}

interface DragState {
  widgetId: string
  mode: 'move' | 'resize'
  displayId: string
  startBounds: WidgetBoundsPatch
  pointerStart: { x: number; y: number }
  scale: number
  moved: boolean
  minWidth: number
  minHeight: number
  area: { left: number; top: number; width: number; height: number }
}

const OPACITY_VALUES = [1, 0.8, 0.6]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function snap(value: number): number {
  return Math.round(value / SNAP_STEP_DIP) * SNAP_STEP_DIP
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function variantName(variantId: string): string {
  const key = `widgets.variantNames.${variantId}`
  const value = t(key)
  return value === key ? variantId : value
}

/** Local copy of a placement as display-relative bounds. */
function boundsOf(widget: WidgetSummary): WidgetBoundsPatch {
  const { placement } = widget
  return {
    displayId: placement.displayId,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height
  }
}

function wallpaperUrlFor(state: WallpaperState): string | null {
  const current = state.items.find((item) => item.id === state.config.currentId)
  if (!current) {
    return null
  }
  const file = current.file.split(/[\\/]/).pop() ?? ''
  if (current.type === 'image' && file) {
    return `hl-wallpaper://media/${current.id}/${encodeURIComponent(file)}`
  }
  return `hl-wallpaper://thumb/${current.id}`
}

export default function DesktopCanvas({
  widgets,
  general,
  runtimeById,
  pending,
  onRefresh,
  onCustomize,
  onVariant,
  onTheme,
  onOpacity,
  onToggleEnabled,
  onToggleLocked,
  onDuplicate,
  onReload,
  onRemove,
  onPermission,
  onEditWithAi,
  toast
}: DesktopCanvasProps): JSX.Element {
  const [displays, setDisplays] = useState<DesktopDisplayInfo[]>([])
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, WidgetBoundsPatch>>({})
  const [scale, setScale] = useState(0.5)
  const [dragId, setDragId] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const draftRef = useRef<Record<string, WidgetBoundsPatch>>({})

  useEffect(() => {
    let active = true
    const load = (): void => {
      void window.api
        .getDisplays()
        .then((list) => {
          if (active) {
            setDisplays(list)
          }
        })
        .catch(() => undefined)
    }
    load()
    window.addEventListener('focus', load)
    return () => {
      active = false
      window.removeEventListener('focus', load)
    }
  }, [])

  useEffect(() => {
    let active = true
    void window.api
      .getWallpaperState()
      .then((state) => {
        if (active) {
          setWallpaperUrl(wallpaperUrlFor(state))
        }
      })
      .catch(() => undefined)
    const off = window.api.onWallpaperChanged((state) => {
      if (active) {
        setWallpaperUrl(wallpaperUrlFor(state))
      }
    })
    return () => {
      active = false
      off()
    }
  }, [])

  const displayById = useMemo(
    () => new Map(displays.map((display) => [display.id, display])),
    [displays]
  )
  const primaryDisplay = displays.find((display) => display.primary) ?? displays[0] ?? null

  const displayNumber = useCallback(
    (displayId: string): number => {
      const index = displays.findIndex((display) => display.id === displayId)
      return index >= 0 ? index + 1 : 1
    },
    [displays]
  )

  /**
   * Bounds to draw on the map. A saved placement can point at a monitor that is
   * gone, or outside the current work area; in that case it is projected onto
   * the primary display and kept partially visible, exactly like the desktop
   * window itself is clamped on restore.
   */
  const boundsFor = useCallback(
    (widget: WidgetSummary): WidgetBoundsPatch => {
      const raw = draft[widget.placement.widgetId] ?? boundsOf(widget)
      const display = displayById.get(raw.displayId) ?? primaryDisplay
      if (!display) {
        return raw
      }
      const areaLeft = display.workArea.x - display.bounds.x
      const areaTop = display.workArea.y - display.bounds.y
      const visibleX = Math.min(raw.width, MIN_VISIBLE_DIP)
      const visibleY = Math.min(raw.height, MIN_VISIBLE_DIP)
      return {
        displayId: display.id,
        x: clamp(
          raw.x,
          areaLeft - raw.width + visibleX,
          areaLeft + display.workArea.width - visibleX
        ),
        y: clamp(
          raw.y,
          areaTop - raw.height + visibleY,
          areaTop + display.workArea.height - visibleY
        ),
        width: raw.width,
        height: raw.height
      }
    },
    [displayById, draft, primaryDisplay]
  )

  /** Union of every display, so multi-monitor arrangements render as they are. */
  const stage = useMemo(() => {
    if (displays.length === 0) {
      return null
    }
    const minX = Math.min(...displays.map((display) => display.bounds.x))
    const minY = Math.min(...displays.map((display) => display.bounds.y))
    const maxX = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width))
    const maxY = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height))
    return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
  }, [displays])

  useEffect(() => {
    const node = stageRef.current
    if (!node || !stage) {
      return
    }
    const update = (): void => {
      const rect = node.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }
      const fit = Math.min((rect.width - 36) / stage.width, (rect.height - 36) / stage.height)
      setScale(clamp(fit, 0.1, 1))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [stage])

  const applyDraft = useCallback((widgetId: string, next: WidgetBoundsPatch): void => {
    setDraft((current) => {
      const map = { ...current, [widgetId]: next }
      draftRef.current = map
      return map
    })
  }, [])

  const clearDraft = useCallback((widgetId: string): void => {
    setDraft((current) => {
      if (!(widgetId in current)) {
        return current
      }
      const map = { ...current }
      delete map[widgetId]
      draftRef.current = map
      return map
    })
  }, [])

  const commit = useCallback(
    async (widgetId: string, next: WidgetBoundsPatch): Promise<void> => {
      try {
        await window.api.setWidgetBounds(widgetId, next)
        clearDraft(widgetId)
        await onRefresh()
      } catch (error) {
        clearDraft(widgetId)
        toast(errorMessage(error), 'error')
      }
    },
    [clearDraft, onRefresh, toast]
  )

  const startDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      widget: WidgetSummary,
      mode: 'move' | 'resize'
    ): void => {
      if (event.button !== 0) {
        return
      }
      const widgetId = widget.placement.widgetId
      setSelectedId(widgetId)
      event.stopPropagation()
      if (widget.placement.locked) {
        return
      }
      const display = displayById.get(boundsFor(widget).displayId) ?? primaryDisplay
      if (!display) {
        return
      }
      const limits = effectiveMinSize(widget.manifest)
      dragRef.current = {
        widgetId,
        mode,
        displayId: display.id,
        startBounds: { ...boundsFor(widget) },
        pointerStart: { x: event.clientX, y: event.clientY },
        scale,
        moved: false,
        minWidth: limits.minWidth,
        minHeight: limits.minHeight,
        area: {
          left: display.workArea.x - display.bounds.x,
          top: display.workArea.y - display.bounds.y,
          width: display.workArea.width,
          height: display.workArea.height
        }
      }
      setDragId(widgetId)
      event.preventDefault()
    },
    [boundsFor, displayById, primaryDisplay, scale]
  )

  useEffect(() => {
    if (!dragId) {
      return
    }

    const onMove = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) {
        return
      }
      // A release that happened before the listeners were attached would leave
      // the drag armed; treat a button-less move as the end of the gesture.
      if (event.buttons === 0) {
        onEnd()
        return
      }
      const dx = (event.clientX - drag.pointerStart.x) / drag.scale
      const dy = (event.clientY - drag.pointerStart.y) / drag.scale
      if (!drag.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) {
        return
      }
      drag.moved = true

      if (drag.mode === 'move') {
        const width = drag.startBounds.width
        const height = drag.startBounds.height
        const minX = drag.area.left - (width - MIN_VISIBLE_DIP)
        const maxX = drag.area.left + drag.area.width - MIN_VISIBLE_DIP
        const minY = drag.area.top - (height - MIN_VISIBLE_DIP)
        const maxY = drag.area.top + drag.area.height - MIN_VISIBLE_DIP
        applyDraft(drag.widgetId, {
          displayId: drag.displayId,
          x: clamp(snap(drag.startBounds.x + dx), minX, maxX),
          y: clamp(snap(drag.startBounds.y + dy), minY, maxY),
          width,
          height
        })
        return
      }

      const maxWidth = Math.max(
        drag.minWidth,
        drag.area.left + drag.area.width - drag.startBounds.x
      )
      const maxHeight = Math.max(
        drag.minHeight,
        drag.area.top + drag.area.height - drag.startBounds.y
      )
      applyDraft(drag.widgetId, {
        ...drag.startBounds,
        width: clamp(snap(drag.startBounds.width + dx), drag.minWidth, maxWidth),
        height: clamp(snap(drag.startBounds.height + dy), drag.minHeight, maxHeight)
      })
    }

    const onEnd = (): void => {
      const drag = dragRef.current
      dragRef.current = null
      setDragId(null)
      if (!drag || !drag.moved) {
        return
      }
      const next = draftRef.current[drag.widgetId]
      if (next) {
        void commit(drag.widgetId, next)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    window.addEventListener('blur', onEnd)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      window.removeEventListener('blur', onEnd)
    }
  }, [applyDraft, commit, dragId])

  const nudge = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, widget: WidgetSummary): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setSelectedId(widget.placement.widgetId)
        return
      }
      if (event.key === 'Escape') {
        setSelectedId(null)
        return
      }
      const delta: readonly [number, number] | null =
        event.key === 'ArrowLeft'
          ? [-1, 0]
          : event.key === 'ArrowRight'
            ? [1, 0]
            : event.key === 'ArrowUp'
              ? [0, -1]
              : event.key === 'ArrowDown'
                ? [0, 1]
                : null
      if (!delta) {
        return
      }
      event.preventDefault()
      if (widget.placement.locked) {
        return
      }
      const display = displayById.get(boundsFor(widget).displayId) ?? primaryDisplay
      if (!display) {
        return
      }
      const step = event.shiftKey ? 1 : SNAP_STEP_DIP
      const area = {
        left: display.workArea.x - display.bounds.x,
        top: display.workArea.y - display.bounds.y,
        width: display.workArea.width,
        height: display.workArea.height
      }
      const current = boundsFor(widget)
      const minX = area.left - (current.width - MIN_VISIBLE_DIP)
      const maxX = area.left + area.width - MIN_VISIBLE_DIP
      const minY = area.top - (current.height - MIN_VISIBLE_DIP)
      const maxY = area.top + area.height - MIN_VISIBLE_DIP
      const next: WidgetBoundsPatch = {
        ...current,
        x: clamp(current.x + delta[0] * step, minX, maxX),
        y: clamp(current.y + delta[1] * step, minY, maxY)
      }
      applyDraft(widget.placement.widgetId, next)
      void commit(widget.placement.widgetId, next)
    },
    [applyDraft, boundsFor, commit, displayById, primaryDisplay]
  )

  const visibleWidgets = useMemo(
    () => widgets.filter((widget) => widget.placement.enabled),
    [widgets]
  )
  const hiddenWidgets = useMemo(
    () => widgets.filter((widget) => !widget.placement.enabled),
    [widgets]
  )

  const widgetsByDisplay = useMemo(() => {
    const map = new Map<string, WidgetSummary[]>()
    for (const widget of visibleWidgets) {
      const bounds = boundsFor(widget)
      const display = displayById.get(bounds.displayId) ?? primaryDisplay
      if (!display) {
        continue
      }
      const list = map.get(display.id) ?? []
      list.push(widget)
      map.set(display.id, list)
    }
    return map
  }, [boundsFor, displayById, primaryDisplay, visibleWidgets])

  const selectedWidget = widgets.find((widget) => widget.placement.widgetId === selectedId) ?? null
  const selectedBuiltin =
    selectedWidget?.manifest.builtinType !== undefined
      ? (findBuiltin(selectedWidget.manifest.builtinType) ?? null)
      : null

  const selectedBounds = selectedWidget ? boundsFor(selectedWidget) : null
  const selectedDisplay =
    selectedBounds === null ? null : (displayById.get(selectedBounds.displayId) ?? primaryDisplay)
  const selectedStats = selectedWidget
    ? runtimeById.get(selectedWidget.placement.widgetId)
    : undefined

  const permissionText = (permission: WidgetPermission): string => t(`permissions.${permission}`)

  if (displays.length === 0) {
    return (
      <div className="desk-layout">
        <div className="desk-stage desk-stage-loading" ref={stageRef}>
          <span>{t('widgets.canvas.loading')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="desk-layout">
      <div className="desk-workbench">
        <div
          className="desk-stage"
          ref={stageRef}
          onPointerDown={() => setSelectedId(null)}
          role="presentation"
        >
          {stage && (
            <div
              className="desk-canvas"
              style={{ width: stage.width * scale, height: stage.height * scale }}
            >
              {displays.map((display) => {
                const displayWidgets = widgetsByDisplay.get(display.id) ?? []
                return (
                  <div
                    className="desk-display"
                    key={display.id}
                    data-primary={display.primary ? 'true' : 'false'}
                    style={{
                      left: (display.bounds.x - stage.minX) * scale,
                      top: (display.bounds.y - stage.minY) * scale,
                      width: display.bounds.width * scale,
                      height: display.bounds.height * scale
                    }}
                  >
                    <div
                      className="desk-display-bg"
                      data-empty={wallpaperUrl ? 'false' : 'true'}
                      style={
                        wallpaperUrl ? { backgroundImage: `url("${wallpaperUrl}")` } : undefined
                      }
                    />
                    <span className="desk-display-tag">
                      {display.primary
                        ? t('widgets.canvas.primaryDisplay', { number: displayNumber(display.id) })
                        : t('widgets.canvas.display', { number: displayNumber(display.id) })}
                    </span>

                    {displayWidgets.map((widget) => {
                      const bounds = boundsFor(widget)
                      const selected = widget.placement.widgetId === selectedId
                      const stats = runtimeById.get(widget.placement.widgetId)
                      return (
                        <div
                          className="desk-widget"
                          key={widget.placement.widgetId}
                          role="button"
                          tabIndex={0}
                          title={widget.manifest.name}
                          aria-label={t('widgets.canvas.widgetLabel', {
                            name: widget.manifest.name
                          })}
                          aria-pressed={selected}
                          data-selected={selected ? 'true' : 'false'}
                          data-locked={widget.placement.locked ? 'true' : 'false'}
                          data-dragging={dragId === widget.placement.widgetId ? 'true' : 'false'}
                          style={{
                            left: bounds.x * scale,
                            top: bounds.y * scale,
                            width: bounds.width * scale,
                            height: bounds.height * scale
                          }}
                          onPointerDown={(event) => startDrag(event, widget, 'move')}
                          onKeyDown={(event) => nudge(event, widget)}
                        >
                          <span
                            className="desk-widget-content"
                            style={{ opacity: widget.placement.opacity }}
                          >
                            <WidgetPreview
                              source={previewSourceFor(widget.manifest)}
                              width={bounds.width}
                              height={bounds.height}
                              dark={
                                (widget.placement.themeOverride ?? general.resolvedWidgetTheme) ===
                                'dark'
                              }
                              appearance={resolveWidgetAppearance(widget.placement)}
                              assetWidgetId={widget.placement.widgetId}
                              cursorStyle={general.cursor.style}
                              title={widget.manifest.name}
                            />
                          </span>

                          {widget.placement.locked && (
                            <span className="desk-widget-lock" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="11" height="11">
                                <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
                                <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
                              </svg>
                            </span>
                          )}

                          {dragId === widget.placement.widgetId && (
                            <span className="desk-widget-badge">
                              {Math.round(bounds.width)} × {Math.round(bounds.height)}
                            </span>
                          )}

                          {selected && !widget.placement.locked && (
                            <span
                              className="desk-widget-handle"
                              aria-hidden="true"
                              onPointerDown={(event) => startDrag(event, widget, 'resize')}
                            />
                          )}

                          {stats?.disabledReason && (
                            <span className="desk-widget-warning" aria-hidden="true">
                              !
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="desk-hint">{t('widgets.canvas.hint')}</p>
      </div>

      <aside className="desk-inspector" aria-label={t('widgets.canvas.inspectorLabel')}>
        {selectedWidget && selectedBounds ? (
          <>
            <header className="desk-inspector-head">
              <div>
                <span className="desk-inspector-eyebrow">
                  {selectedWidget.manifest.kind === 'builtin'
                    ? t('widgets.kindBuiltin')
                    : t('widgets.kindAi')}
                </span>
                <h3>{selectedWidget.manifest.name}</h3>
              </div>
              <button
                type="button"
                className="desk-inspector-close"
                aria-label={t('common.close')}
                onClick={() => setSelectedId(null)}
              >
                &#10005;
              </button>
            </header>

            <div className="desk-inspector-status">
              <span
                className={
                  selectedStats?.disabledReason ? 'status-pill status-bad' : 'status-pill status-on'
                }
              >
                <span className="status-dot" aria-hidden="true" />
                {selectedStats?.disabledReason
                  ? t('widgets.statusDisabled')
                  : t('widgets.statusRunning')}
              </span>
              {selectedStats && (
                <span className="runtime-text">
                  {selectedStats.cpuPercent.toFixed(1)}% · {Math.round(selectedStats.memoryMB)} MB
                </span>
              )}
            </div>

            <dl className="desk-readout">
              <div>
                <dt>{t('widgets.canvas.position')}</dt>
                <dd>
                  {Math.round(selectedBounds.x)}, {Math.round(selectedBounds.y)}
                </dd>
              </div>
              <div>
                <dt>{t('widgets.canvas.size')}</dt>
                <dd>
                  {Math.round(selectedBounds.width)} × {Math.round(selectedBounds.height)}
                </dd>
              </div>
              <div>
                <dt>{t('widgets.canvas.display')}</dt>
                <dd>
                  {selectedDisplay
                    ? t('widgets.canvas.display', { number: displayNumber(selectedDisplay.id) })
                    : '—'}
                </dd>
              </div>
            </dl>

            <div className="desk-inspector-fields">
              {selectedBuiltin && selectedBuiltin.variants.length > 1 && (
                <label className="inline-field">
                  <span>{t('widgets.design')}</span>
                  <select
                    value={selectedWidget.manifest.variant ?? selectedBuiltin.variants[0]?.id ?? ''}
                    disabled={pending !== null}
                    onChange={(event) => onVariant(selectedWidget, event.target.value)}
                  >
                    {selectedBuiltin.variants.map((variant) => (
                      <option value={variant.id} key={variant.id}>
                        {variantName(variant.id)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="inline-field">
                <span>{t('widgets.customize.theme')}</span>
                <select
                  value={selectedWidget.placement.themeOverride ?? 'auto'}
                  disabled={pending !== null}
                  onChange={(event) => onTheme(selectedWidget, event.target.value)}
                >
                  <option value="auto">{t('widgets.customize.themeAuto')}</option>
                  <option value="dark">{t('general.themeDark')}</option>
                  <option value="light">{t('general.themeLight')}</option>
                </select>
              </label>

              <label className="inline-field">
                <span>{t('widgets.opacity')}</span>
                <select
                  value={selectedWidget.placement.opacity}
                  disabled={pending !== null}
                  onChange={(event) => onOpacity(selectedWidget, Number(event.target.value))}
                >
                  {(OPACITY_VALUES.includes(selectedWidget.placement.opacity)
                    ? OPACITY_VALUES
                    : [...OPACITY_VALUES, selectedWidget.placement.opacity].sort(
                        (left, right) => right - left
                      )
                  ).map((value) => (
                    <option value={value} key={value}>
                      {Math.round(value * 100)}%
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="desk-inspector-actions">
              {selectedWidget.manifest.builtinType && (
                <button
                  type="button"
                  className="button-primary button-compact"
                  disabled={pending !== null}
                  onClick={() => onCustomize(selectedWidget)}
                >
                  {t('widgets.customize.action')}
                </button>
              )}
              <button
                type="button"
                className="button-secondary button-compact"
                disabled={pending !== null}
                onClick={() => onDuplicate(selectedWidget.placement.widgetId)}
              >
                {t('widgets.duplicate')}
              </button>
              <button
                type="button"
                className="button-secondary button-compact"
                disabled={pending !== null}
                onClick={() => onReload(selectedWidget.placement.widgetId)}
              >
                {t('widgets.reload')}
              </button>
              <button
                type="button"
                className="button-secondary button-compact"
                disabled={pending !== null}
                onClick={() => onToggleLocked(selectedWidget)}
              >
                {selectedWidget.placement.locked ? t('widgets.unlock') : t('widgets.lock')}
              </button>
              <button
                type="button"
                className="button-secondary button-compact"
                disabled={
                  pending !== null || (general.safeMode && !selectedWidget.placement.enabled)
                }
                onClick={() => onToggleEnabled(selectedWidget, !selectedWidget.placement.enabled)}
              >
                {selectedWidget.placement.enabled ? t('common.disable') : t('common.enable')}
              </button>
              {selectedWidget.manifest.kind === 'ai' && (
                <button
                  type="button"
                  className="button-secondary button-compact"
                  disabled={pending !== null}
                  onClick={() => onEditWithAi(selectedWidget.placement.widgetId)}
                >
                  {t('widgets.editWithAi')}
                </button>
              )}
              <button
                type="button"
                className="button-danger button-compact"
                disabled={pending !== null}
                onClick={() => onRemove(selectedWidget.placement.widgetId)}
              >
                {t('common.remove')}
              </button>
            </div>

            {selectedWidget.manifest.permissions.length > 0 && (
              <details className="desk-permissions">
                <summary>
                  {t('widgets.permissionsCount', {
                    count: selectedWidget.manifest.permissions.length
                  })}
                </summary>
                <div className="desk-permissions-list">
                  {selectedWidget.manifest.permissions.map((permission) => (
                    <label className="permission-toggle" key={permission}>
                      <input
                        type="checkbox"
                        checked={selectedWidget.manifest.grantedPermissions.includes(permission)}
                        disabled={pending !== null}
                        onChange={(event) =>
                          onPermission(selectedWidget, permission, event.target.checked)
                        }
                      />
                      <span>{permissionText(permission)}</span>
                    </label>
                  ))}
                </div>
                {selectedWidget.manifest.allowedHosts.length > 0 && (
                  <span className="permission-hosts">
                    {t('widgets.approvedHosts', {
                      hosts: selectedWidget.manifest.allowedHosts.join(', ')
                    })}
                  </span>
                )}
              </details>
            )}
          </>
        ) : (
          <div className="desk-inspector-empty">
            <span className="desk-inspector-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <rect x="3" y="4" width="18" height="13" rx="2.5" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </span>
            <strong>{t('widgets.canvas.emptyTitle')}</strong>
            <p>{t('widgets.canvas.emptyBody')}</p>
          </div>
        )}

        {hiddenWidgets.length > 0 && (
          <section className="desk-hidden">
            <h4>
              {t('widgets.canvas.hiddenTitle')} · {hiddenWidgets.length}
            </h4>
            <div className="desk-hidden-list">
              {hiddenWidgets.map((widget) => (
                <button
                  type="button"
                  key={widget.placement.widgetId}
                  disabled={pending !== null || general.safeMode}
                  onClick={() => onToggleEnabled(widget, true)}
                >
                  <span>{widget.manifest.name}</span>
                  <span className="desk-hidden-show">{t('common.enable')}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  )
}
