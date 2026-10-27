import { useEffect, useMemo, useState, type JSX } from 'react'
import { findBuiltin, findBuiltinVariant } from '../../shared/builtins'
import type {
  BuiltinWidget,
  GeneralState,
  WidgetCategory,
  WidgetManifest,
  WidgetPermission,
  WidgetRuntimeInfo,
  WidgetSummary
} from '../../shared/types'
import { WIDGET_CATEGORIES } from '../../shared/types'
import { t } from '../i18n'
import type { ToastLevel } from './useToasts'
import WidgetPreview, { type PreviewSource } from './WidgetPreview'

interface WidgetsPanelProps {
  widgets: WidgetSummary[]
  builtins: BuiltinWidget[]
  savedAiWidgets: WidgetManifest[]
  runtime: WidgetRuntimeInfo[]
  general: GeneralState
  onRefresh: () => Promise<void>
  onEditWithAi: (widgetId: string) => void
  onOpenAiStudio: () => void
  toast: (message: string, level?: ToastLevel) => void
}

type StudioView = 'browse' | 'desktop' | 'saved'
type CategoryFilter = 'all' | WidgetCategory

const OPACITY_VALUES = [1, 0.8, 0.6]

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function catalogName(type: string, fallback: string): string {
  const key = `widgets.catalog.${type}.name`
  const value = t(key)
  return value === key ? fallback : value
}

function catalogBody(type: string, fallback: string): string {
  const key = `widgets.catalog.${type}.body`
  const value = t(key)
  return value === key ? fallback : value
}

function variantName(variantId: string): string {
  const key = `widgets.variantNames.${variantId}`
  const value = t(key)
  return value === key ? variantId : value
}

function previewDimensions(
  manifest: WidgetManifest,
  builtins: BuiltinWidget[]
): { width: number; height: number } {
  if (manifest.builtinType) {
    const builtin = builtins.find((entry) => entry.type === manifest.builtinType)
    if (builtin) {
      const variant = findBuiltinVariant(builtin, manifest.variant)
      return { width: variant.width, height: variant.height }
    }
  }
  return { width: manifest.width, height: manifest.height }
}

function previewSource(manifest: WidgetManifest): PreviewSource {
  if (manifest.kind === 'builtin' && manifest.builtinType) {
    return {
      kind: 'builtin',
      type: manifest.builtinType,
      variant: manifest.variant ?? 'classic'
    }
  }
  return { kind: 'widget', id: manifest.id }
}

function SearchIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

export default function WidgetsPanel({
  widgets,
  builtins,
  savedAiWidgets,
  runtime,
  general,
  onRefresh,
  onEditWithAi,
  onOpenAiStudio,
  toast
}: WidgetsPanelProps): JSX.Element {
  const [pending, setPending] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [sortByRam, setSortByRam] = useState(false)
  const [view, setView] = useState<StudioView>('browse')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [variants, setVariants] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      builtins.flatMap((builtin) =>
        builtin.variants[0] ? [[builtin.type, builtin.variants[0].id]] : []
      )
    )
  )

  useEffect(() => {
    void window.api
      .getEditMode()
      .then(setEditMode)
      .catch(() => undefined)
  }, [])

  const runtimeById = useMemo(
    () => new Map(runtime.map((entry) => [entry.widgetId, entry])),
    [runtime]
  )

  const orderedWidgets = useMemo(() => {
    if (!sortByRam) {
      return widgets
    }
    return [...widgets].sort(
      (left, right) =>
        (runtimeById.get(right.placement.widgetId)?.memoryMB ?? 0) -
        (runtimeById.get(left.placement.widgetId)?.memoryMB ?? 0)
    )
  }, [runtimeById, sortByRam, widgets])

  const filteredBuiltins = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return builtins.filter((builtin) => {
      if (category !== 'all' && builtin.category !== category) {
        return false
      }
      if (!needle) {
        return true
      }
      return (
        catalogName(builtin.type, builtin.name).toLowerCase().includes(needle) ||
        catalogBody(builtin.type, builtin.description).toLowerCase().includes(needle) ||
        builtin.type.includes(needle)
      )
    })
  }, [builtins, category, query])

  const permissionText = (permission: WidgetPermission): string => t(`permissions.${permission}`)

  const variantFor = (builtin: BuiltinWidget): string =>
    builtin.variants.find((variant) => variant.id === variants[builtin.type])?.id ??
    builtin.variants[0]?.id ??
    'classic'

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    success?: string
  ): Promise<void> => {
    setPending(key)
    try {
      await action()
      await onRefresh()
      if (success) {
        toast(success, 'success')
      }
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const addWidget = async (builtin: BuiltinWidget): Promise<void> => {
    const variant = variantFor(builtin)
    await run(
      `add:${builtin.type}`,
      () => window.api.addWidget(builtin.type, variant),
      t('widgets.addedDesign', {
        name: catalogName(builtin.type, builtin.name),
        design: variantName(variant)
      })
    )
  }

  const removeWidget = async (widgetId: string): Promise<void> => {
    const isAi = widgets.some(
      (widget) => widget.placement.widgetId === widgetId && widget.manifest.kind === 'ai'
    )
    setPending(`remove:${widgetId}`)
    try {
      const removed = await window.api.removeWidget(widgetId)
      await onRefresh()
      toast(
        removed
          ? isAi
            ? t('widgets.removedSaved')
            : t('widgets.removed')
          : t('widgets.removeCancelled')
      )
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const addAiWidgetCopy = async (widgetId: string): Promise<void> => {
    const manifest = savedAiWidgets.find((item) => item.id === widgetId)
    await run(
      `add-ai:${widgetId}`,
      () => window.api.addAiWidgetCopy(widgetId),
      manifest ? t('widgets.added', { name: manifest.name }) : undefined
    )
  }

  const deleteAiWidget = async (widgetId: string): Promise<void> => {
    setPending(`delete-ai:${widgetId}`)
    try {
      const deleted = await window.api.deleteAiWidget(widgetId)
      await onRefresh()
      toast(deleted ? t('widgets.deletedSaved') : t('widgets.deleteCancelled'))
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const togglePermission = async (
    widget: WidgetSummary,
    permission: WidgetPermission,
    granted: boolean
  ): Promise<void> => {
    try {
      await window.api.setWidgetPermission(widget.placement.widgetId, permission, granted)
      await onRefresh()
      toast(
        granted
          ? t('widgets.permissionAllowed', {
              permission: permissionText(permission),
              name: widget.manifest.name
            })
          : t('widgets.permissionRevoked', {
              permission: permissionText(permission),
              name: widget.manifest.name
            }),
        granted ? 'success' : 'info'
      )
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  const toggleEditMode = async (): Promise<void> => {
    const next = !editMode
    try {
      setEditMode(await window.api.setEditMode(next))
      toast(next ? t('widgets.editModeOn') : t('widgets.editModeOff'), 'info')
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  const toggleEnabled = async (widget: WidgetSummary, enabled: boolean): Promise<void> => {
    setPending(`enabled:${widget.placement.widgetId}`)
    try {
      await window.api.setWidgetEnabled(widget.placement.widgetId, enabled)
      await onRefresh()
      toast(
        t(enabled ? 'widgets.shown' : 'widgets.hidden', { name: widget.manifest.name }),
        'success'
      )
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const toggleLocked = async (widget: WidgetSummary): Promise<void> => {
    const next = !widget.placement.locked
    setPending(`lock:${widget.placement.widgetId}`)
    try {
      await window.api.setWidgetLocked(widget.placement.widgetId, next)
      await onRefresh()
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const setOpacity = async (widget: WidgetSummary, opacity: number): Promise<void> => {
    setPending(`opacity:${widget.placement.widgetId}`)
    try {
      await window.api.setWidgetOpacity(widget.placement.widgetId, opacity)
      await onRefresh()
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const changeVariant = async (widget: WidgetSummary, variantId: string): Promise<void> => {
    await run(
      `variant:${widget.placement.widgetId}`,
      () => window.api.setWidgetVariant(widget.placement.widgetId, variantId),
      t('widgets.designChanged', {
        name: widget.manifest.name,
        design: variantName(variantId)
      })
    )
  }

  const categoryCount = (id: CategoryFilter): number =>
    id === 'all' ? builtins.length : builtins.filter((builtin) => builtin.category === id).length

  const activeCategories = WIDGET_CATEGORIES.filter((id) =>
    builtins.some((builtin) => builtin.category === id)
  )

  return (
    <div className="studio">
      <div className="studio-switcher">
        <div className="view-tabs" role="tablist" aria-label={t('widgets.viewsLabel')}>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'browse'}
            className={view === 'browse' ? 'view-tab view-tab-active' : 'view-tab'}
            onClick={() => setView('browse')}
          >
            {t('widgets.viewBrowse')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'desktop'}
            className={view === 'desktop' ? 'view-tab view-tab-active' : 'view-tab'}
            onClick={() => setView('desktop')}
          >
            {t('widgets.viewDesktop')}
            <span className="tab-count">{widgets.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'saved'}
            className={view === 'saved' ? 'view-tab view-tab-active' : 'view-tab'}
            onClick={() => setView('saved')}
          >
            {t('widgets.viewSaved')}
            <span className="tab-count">{savedAiWidgets.length}</span>
          </button>
        </div>
        <div className="studio-actions">
          <span className="shortcut-pill">
            <kbd>{general.hotkey}</kbd>
            {t('widgets.shortcutLabel')}
          </span>
          <button
            type="button"
            className={editMode ? 'button-secondary button-active' : 'button-secondary'}
            onClick={() => void toggleEditMode()}
            disabled={pending !== null}
          >
            {editMode ? t('widgets.finishEditing') : t('widgets.editLayout')}
          </button>
        </div>
      </div>

      {view === 'browse' && (
        <>
          <div className="studio-toolbar">
            <label className="search-field">
              <SearchIcon />
              <span className="sr-only">{t('widgets.searchLabel')}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('widgets.searchPlaceholder')}
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery('')}
                  aria-label={t('widgets.clearSearch')}
                >
                  ×
                </button>
              )}
            </label>
            <div className="filter-chips" role="group" aria-label={t('widgets.categoriesLabel')}>
              <button
                type="button"
                className={category === 'all' ? 'filter-chip chip-active' : 'filter-chip'}
                onClick={() => setCategory('all')}
              >
                {t('widgets.categoryAll')}
                <span>{categoryCount('all')}</span>
              </button>
              {activeCategories.map((id) => (
                <button
                  type="button"
                  key={id}
                  className={category === id ? 'filter-chip chip-active' : 'filter-chip'}
                  onClick={() => setCategory(id)}
                >
                  {t(`widgets.categories.${id}`)}
                  <span>{categoryCount(id)}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredBuiltins.length === 0 ? (
            <div className="empty-state">
              <strong>{t('widgets.noMatchesTitle')}</strong>
              <span>{t('widgets.noMatchesBody')}</span>
            </div>
          ) : (
            <div className="studio-grid">
              {filteredBuiltins.map((builtin) => {
                const count = widgets.filter(
                  (widget) => widget.manifest.builtinType === builtin.type
                ).length
                const selectedVariant = findBuiltinVariant(builtin, variantFor(builtin))
                const busy = pending === `add:${builtin.type}`
                return (
                  <article className="studio-card" key={builtin.type}>
                    <div className="studio-preview">
                      <WidgetPreview
                        source={{
                          kind: 'builtin',
                          type: builtin.type,
                          variant: selectedVariant.id
                        }}
                        width={selectedVariant.width}
                        height={selectedVariant.height}
                        dark={general.resolvedTheme === 'dark'}
                        cursorStyle={general.cursorStyle}
                        title={catalogName(builtin.type, builtin.name)}
                      />
                      <span className="preview-badge">
                        <span className="live-dot" aria-hidden="true" />
                        {t('widgets.livePreview')}
                      </span>
                      {count > 0 && (
                        <span className="preview-count">
                          {t('widgets.onDesktopCount', { count })}
                        </span>
                      )}
                    </div>
                    <div className="studio-card-body">
                      <div className="studio-card-head">
                        <div>
                          <h3>{catalogName(builtin.type, builtin.name)}</h3>
                          <span className="category-tag">
                            {t(`widgets.categories.${builtin.category}`)}
                          </span>
                        </div>
                        <span className="dimension-tag">
                          {t('widgets.dimensions', {
                            width: selectedVariant.width,
                            height: selectedVariant.height
                          })}
                        </span>
                      </div>
                      <p>{catalogBody(builtin.type, builtin.description)}</p>
                      <div
                        className="variant-row"
                        role="radiogroup"
                        aria-label={t('widgets.designFor', {
                          name: catalogName(builtin.type, builtin.name)
                        })}
                      >
                        {builtin.variants.map((variant) => (
                          <button
                            type="button"
                            key={variant.id}
                            role="radio"
                            aria-checked={selectedVariant.id === variant.id}
                            className={
                              selectedVariant.id === variant.id
                                ? 'variant-pill variant-active'
                                : 'variant-pill'
                            }
                            onClick={() =>
                              setVariants((current) => ({
                                ...current,
                                [builtin.type]: variant.id
                              }))
                            }
                          >
                            {variantName(variant.id)}
                          </button>
                        ))}
                      </div>
                      <div className="studio-card-foot">
                        <span className="design-label">
                          {t('widgets.selectedDesign', {
                            design: variantName(selectedVariant.id)
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => void addWidget(builtin)}
                          disabled={pending !== null || general.safeMode}
                          title={general.safeMode ? t('widgets.safeMode') : undefined}
                        >
                          {busy ? t('common.adding') : t('widgets.addToDesktop')}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      {view === 'desktop' && (
        <section className="desktop-panel">
          <div className="desktop-toolbar">
            <div>
              <h2>{t('widgets.desktopTitle')}</h2>
              <p>{t('widgets.desktopBody')}</p>
            </div>
            <div className="toolbar-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setSortByRam((current) => !current)}
              >
                {sortByRam ? t('widgets.sortDefault') : t('widgets.sortRam')}
              </button>
              <button type="button" onClick={() => setView('browse')}>
                {t('widgets.addWidget')}
              </button>
            </div>
          </div>

          {orderedWidgets.length === 0 ? (
            <div className="empty-state">
              <strong>{t('widgets.noWidgets')}</strong>
              <span>{t('widgets.noWidgetsBody')}</span>
              <button type="button" onClick={() => setView('browse')}>
                {t('widgets.browseWidgets')}
              </button>
            </div>
          ) : (
            <div className="desktop-list">
              {orderedWidgets.map((widget) => {
                const { manifest, placement } = widget
                const stats = runtimeById.get(placement.widgetId)
                const opacityOptions = OPACITY_VALUES.includes(placement.opacity)
                  ? OPACITY_VALUES
                  : [...OPACITY_VALUES, placement.opacity].sort((left, right) => right - left)
                const builtin = manifest.builtinType ? findBuiltin(manifest.builtinType) : undefined
                const dimensions = previewDimensions(manifest, builtins)
                return (
                  <article className="desktop-card" key={placement.widgetId}>
                    <div className="desktop-thumb">
                      <WidgetPreview
                        source={previewSource(manifest)}
                        width={dimensions.width}
                        height={dimensions.height}
                        dark={general.resolvedTheme === 'dark'}
                        cursorStyle={general.cursorStyle}
                        title={manifest.name}
                      />
                      <span className={placement.enabled ? 'state-dot state-on' : 'state-dot'} />
                    </div>

                    <div className="desktop-card-main">
                      <div className="desktop-card-head">
                        <div>
                          <h3>{manifest.name}</h3>
                          <span className="meta-line">
                            {manifest.kind === 'builtin'
                              ? t('widgets.kindBuiltin')
                              : t('widgets.kindAi')}{' '}
                            ·{' '}
                            {t('widgets.dimensions', {
                              width: placement.width,
                              height: placement.height
                            })}
                            {!placement.enabled && ` · ${t('widgets.hiddenStatus')}`}
                          </span>
                        </div>
                        {stats && (
                          <span
                            className={
                              stats.disabledReason ? 'runtime-badge runtime-bad' : 'runtime-badge'
                            }
                          >
                            {stats.running
                              ? `${t('widgets.cpu', { value: stats.cpuPercent.toFixed(1) })} · ${t(
                                  'widgets.ram',
                                  { value: Math.round(stats.memoryMB) }
                                )}`
                              : t('widgets.stopped')}
                            {stats.disabledReason
                              ? ` · ${t('widgets.disabledBadge', { reason: stats.disabledReason })}`
                              : ''}
                          </span>
                        )}
                      </div>

                      <div className="desktop-controls">
                        {builtin && builtin.variants.length > 1 && (
                          <label className="inline-field">
                            <span>{t('widgets.design')}</span>
                            <select
                              value={manifest.variant ?? builtin.variants[0]?.id ?? ''}
                              disabled={pending !== null}
                              onChange={(event) => void changeVariant(widget, event.target.value)}
                            >
                              {builtin.variants.map((variant) => (
                                <option value={variant.id} key={variant.id}>
                                  {variantName(variant.id)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label className="inline-field">
                          <span>{t('widgets.opacity')}</span>
                          <select
                            value={placement.opacity}
                            disabled={pending !== null}
                            onChange={(event) =>
                              void setOpacity(widget, Number(event.target.value))
                            }
                          >
                            {opacityOptions.map((value) => (
                              <option value={value} key={value}>
                                {Math.round(value * 100)}%
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="desktop-quick-actions">
                          <button
                            type="button"
                            className="button-secondary button-compact"
                            onClick={() => void toggleEnabled(widget, !placement.enabled)}
                            disabled={pending !== null || (general.safeMode && !placement.enabled)}
                          >
                            {placement.enabled ? t('common.disable') : t('common.enable')}
                          </button>
                          <button
                            type="button"
                            className="button-secondary button-compact"
                            onClick={() => void toggleLocked(widget)}
                            disabled={pending !== null}
                          >
                            {placement.locked ? t('widgets.unlock') : t('widgets.lock')}
                          </button>
                        </div>
                      </div>

                      <div className="desktop-footer">
                        <details className="permission-details">
                          <summary>
                            {manifest.permissions.length === 0
                              ? t('widgets.permissionsNone')
                              : t('widgets.permissionsCount', {
                                  count: manifest.permissions.length
                                })}
                          </summary>
                          {manifest.permissions.length > 0 && (
                            <div className="permission-list">
                              {manifest.permissions.map((permission) => (
                                <label className="permission-toggle" key={permission}>
                                  <input
                                    type="checkbox"
                                    checked={manifest.grantedPermissions.includes(permission)}
                                    disabled={pending !== null}
                                    onChange={(event) =>
                                      void togglePermission(
                                        widget,
                                        permission,
                                        event.target.checked
                                      )
                                    }
                                  />
                                  <span>{permissionText(permission)}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          {manifest.allowedHosts.length > 0 && (
                            <span className="permission-hosts">
                              {t('widgets.approvedHosts', {
                                hosts: manifest.allowedHosts.join(', ')
                              })}
                            </span>
                          )}
                        </details>

                        <div className="desktop-row-actions">
                          <button
                            type="button"
                            className="button-secondary button-compact"
                            onClick={() =>
                              void run(`duplicate:${placement.widgetId}`, () =>
                                window.api.duplicateWidget(placement.widgetId)
                              )
                            }
                            disabled={pending !== null || general.safeMode}
                          >
                            {t('widgets.duplicate')}
                          </button>
                          <button
                            type="button"
                            className="button-secondary button-compact"
                            onClick={() =>
                              void run(`reload:${placement.widgetId}`, () =>
                                window.api.reloadWidget(placement.widgetId)
                              )
                            }
                            disabled={pending !== null}
                          >
                            {t('widgets.reload')}
                          </button>
                          {manifest.kind === 'ai' && (
                            <button
                              type="button"
                              className="button-secondary button-compact"
                              onClick={() => onEditWithAi(placement.widgetId)}
                            >
                              {t('widgets.editWithAi')}
                            </button>
                          )}
                          <button
                            type="button"
                            className="button-danger button-compact"
                            onClick={() => void removeWidget(placement.widgetId)}
                            disabled={pending !== null}
                          >
                            {pending === `remove:${placement.widgetId}`
                              ? t('common.removing')
                              : t('common.remove')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {view === 'saved' && (
        <section className="desktop-panel">
          <div className="desktop-toolbar">
            <div>
              <h2>{t('widgets.savedTitle')}</h2>
              <p>{t('widgets.savedBody')}</p>
            </div>
            <span className="section-count">
              {t('widgets.savedCount', { count: savedAiWidgets.length })}
            </span>
          </div>

          {savedAiWidgets.length === 0 ? (
            <div className="empty-state">
              <strong>{t('widgets.noSaved')}</strong>
              <span>{t('widgets.noSavedBody')}</span>
              <button type="button" onClick={onOpenAiStudio}>
                {t('widgets.openAiStudio')}
              </button>
            </div>
          ) : (
            <div className="saved-grid">
              {savedAiWidgets.map((manifest) => (
                <article className="saved-card" key={manifest.id}>
                  <div className="saved-preview">
                    <WidgetPreview
                      source={{ kind: 'widget', id: manifest.id }}
                      width={manifest.width}
                      height={manifest.height}
                      dark={general.resolvedTheme === 'dark'}
                      cursorStyle={general.cursorStyle}
                      title={manifest.name}
                    />
                  </div>
                  <div className="saved-copy">
                    <h3>{manifest.name}</h3>
                    <span className="meta-line">
                      {t('widgets.dimensions', {
                        width: manifest.width,
                        height: manifest.height
                      })}{' '}
                      · {t('widgets.generated', { date: formatDate(manifest.createdAt) })}
                    </span>
                    {manifest.prompt && (
                      <p className="widget-prompt" title={manifest.prompt}>
                        {manifest.prompt}
                      </p>
                    )}
                  </div>
                  <div className="saved-actions">
                    <button
                      type="button"
                      onClick={() => void addAiWidgetCopy(manifest.id)}
                      disabled={pending !== null || general.safeMode}
                    >
                      {pending === `add-ai:${manifest.id}`
                        ? t('common.adding')
                        : t('widgets.addCopy')}
                    </button>
                    <button
                      type="button"
                      className="button-danger button-compact"
                      onClick={() => void deleteAiWidget(manifest.id)}
                      disabled={pending !== null}
                    >
                      {pending === `delete-ai:${manifest.id}`
                        ? t('common.deleting')
                        : t('common.delete')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
