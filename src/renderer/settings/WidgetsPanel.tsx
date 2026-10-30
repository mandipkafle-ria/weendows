import { useEffect, useMemo, useState, type JSX } from 'react'
import { findBuiltinVariant } from '../../shared/builtins'
import { WIDGET_CATEGORIES } from '../../shared/types'
import type {
  BuiltinWidget,
  GeneralState,
  WidgetCategory,
  WidgetManifest,
  WidgetPermission,
  WidgetRuntimeInfo,
  WidgetSummary
} from '../../shared/types'
import { t } from '../i18n'
import type { ToastLevel } from './useToasts'
import ConfirmDialog from './ConfirmDialog'
import DesktopCanvas from './DesktopCanvas'
import ExpandableSearch from './ExpandableSearch'
import ThemeScene from './ThemeScene'
import { THEME_OPTIONS, type ThemeEnvId } from './themeEnvironments'
import WidgetCatalog from './WidgetCatalog'
import WidgetCategoryPage from './WidgetCategoryPage'
import WidgetCustomizeSheet from './WidgetCustomizeSheet'
import WidgetPreview from './WidgetPreview'

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
  const [view, setView] = useState<StudioView>('browse')
  const [browseSubView, setBrowseSubView] = useState<'scene' | 'catalog'>('scene')
  const [themeEnv, setThemeEnv] = useState<ThemeEnvId>('sky')
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark')
  const [categoryFilter, setCategoryFilter] = useState<WidgetCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [categoryPage, setCategoryPage] = useState<WidgetCategory | null>(null)
  const [savedQuery, setSavedQuery] = useState('')
  const [savedSort, setSavedSort] = useState<'newest' | 'name'>('newest')
  const [removalTarget, setRemovalTarget] = useState<{
    kind: 'remove' | 'delete'
    widgetId: string
    name: string
  } | null>(null)
  const [customize, setCustomize] = useState<{
    builtin: BuiltinWidget
    variant: string
    existing?: WidgetSummary
  } | null>(null)

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

  const filteredBuiltins = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return builtins.filter((builtin) => {
      if (!needle) {
        return true
      }
      return (
        catalogName(builtin.type, builtin.name).toLowerCase().includes(needle) ||
        catalogBody(builtin.type, builtin.description).toLowerCase().includes(needle) ||
        builtin.type.includes(needle)
      )
    })
  }, [builtins, query])

  const catalogBuiltins = useMemo(
    () =>
      categoryFilter === 'all'
        ? filteredBuiltins
        : filteredBuiltins.filter((builtin) => builtin.category === categoryFilter),
    [categoryFilter, filteredBuiltins]
  )

  const visibleSaved = useMemo(() => {
    const needle = savedQuery.trim().toLowerCase()
    const matches = savedAiWidgets.filter((manifest) => {
      if (!needle) {
        return true
      }
      return (
        manifest.name.toLowerCase().includes(needle) ||
        (manifest.prompt ?? '').toLowerCase().includes(needle)
      )
    })
    return [...matches].sort((left, right) => {
      if (savedSort === 'name') {
        return left.name.localeCompare(right.name)
      }
      return right.createdAt.localeCompare(left.createdAt)
    })
  }, [savedAiWidgets, savedQuery, savedSort])

  const activeTheme = THEME_OPTIONS.find((option) => option.id === themeEnv) ?? THEME_OPTIONS[0]!

  const permissionText = (permission: WidgetPermission): string => t(`permissions.${permission}`)

  const variantFor = (builtin: BuiltinWidget): string => builtin.variants[0]?.id ?? 'classic'

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

  const addWidget = async (builtin: BuiltinWidget, variantId?: string): Promise<void> => {
    const variant = variantId ?? variantFor(builtin)
    await run(
      `add:${builtin.type}`,
      () => window.api.addWidget(builtin.type, variant),
      t('widgets.addedDesign', {
        name: catalogName(builtin.type, builtin.name),
        design: variantName(variant)
      })
    )
  }

  const openCustomize = (builtin: BuiltinWidget, variant: string): void => {
    setCustomize({ builtin, variant })
  }

  const openSceneCustomize = (builtin: BuiltinWidget, variant: string): void => {
    const existing = widgets.find(
      (widget) =>
        widget.manifest.builtinType === builtin.type &&
        findBuiltinVariant(builtin, widget.manifest.variant).id === variant
    )
    setCustomize({ builtin, variant, existing })
  }

  const openCustomizeExisting = (widget: WidgetSummary): void => {
    if (!widget.manifest.builtinType) {
      return
    }
    const builtin = builtins.find((entry) => entry.type === widget.manifest.builtinType)
    if (!builtin) {
      return
    }
    setCustomize({
      builtin,
      variant: findBuiltinVariant(builtin, widget.manifest.variant).id,
      existing: widget
    })
  }

  const removeWidget = (widgetId: string): void => {
    const widget = widgets.find((entry) => entry.placement.widgetId === widgetId)
    if (!widget) {
      return
    }
    setRemovalTarget({ kind: 'remove', widgetId, name: widget.manifest.name })
  }

  const addAiWidgetCopy = async (widgetId: string): Promise<void> => {
    const manifest = savedAiWidgets.find((item) => item.id === widgetId)
    await run(
      `add-ai:${widgetId}`,
      () => window.api.addAiWidgetCopy(widgetId),
      manifest ? t('widgets.added', { name: manifest.name }) : undefined
    )
  }

  const deleteAiWidget = (widgetId: string): void => {
    const manifest = savedAiWidgets.find((item) => item.id === widgetId)
    setRemovalTarget({ kind: 'delete', widgetId, name: manifest?.name ?? '' })
  }

  const confirmRemoval = async (): Promise<void> => {
    const target = removalTarget
    if (!target) {
      return
    }
    setRemovalTarget(null)
    const isAi =
      target.kind === 'delete' ||
      widgets.some(
        (widget) => widget.placement.widgetId === target.widgetId && widget.manifest.kind === 'ai'
      )
    setPending(`${target.kind === 'delete' ? 'delete-ai' : 'remove'}:${target.widgetId}`)
    try {
      const done =
        target.kind === 'delete'
          ? await window.api.deleteAiWidget(target.widgetId, true)
          : await window.api.removeWidget(target.widgetId, true)
      await onRefresh()
      if (target.kind === 'delete') {
        toast(done ? t('widgets.deletedSaved') : t('widgets.deleteCancelled'))
      } else {
        toast(
          done
            ? isAi
              ? t('widgets.removedSaved')
              : t('widgets.removed')
            : t('widgets.removeCancelled')
        )
      }
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

  const changeTheme = async (widget: WidgetSummary, value: string): Promise<void> => {
    const themeOverride = value === 'auto' ? null : (value as 'dark' | 'light')
    await run(`theme:${widget.placement.widgetId}`, () =>
      window.api.setWidgetAppearance(widget.placement.widgetId, { themeOverride })
    )
  }

  return (
    <div className="studio">
      <div className="studio-topbar">
        <div className="view-tabs" role="tablist" aria-label={t('widgets.viewsLabel')}>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'browse'}
            className={view === 'browse' ? 'view-tab view-tab-active' : 'view-tab'}
            onClick={() => {
              setView('browse')
              setCategoryPage(null)
              setBrowseSubView('scene')
            }}
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

        <div className="studio-theme">
          <span className="theme-quick-label">{activeTheme.label}</span>
          <div
            className="theme-quick-switch"
            role="radiogroup"
            aria-label={t('widgets.themeLabel')}
          >
            {THEME_OPTIONS.map((theme) => {
              const active = themeEnv === theme.id
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={theme.label}
                  title={theme.label}
                  className={active ? 'theme-swatch theme-swatch-active' : 'theme-swatch'}
                  style={{ backgroundColor: theme.color }}
                  onClick={() => setThemeEnv(theme.id)}
                />
              )
            })}
          </div>

          <div className="theme-mode-switch" role="radiogroup" aria-label="Theme mode">
            <button
              type="button"
              role="radio"
              aria-checked={themeMode === 'light'}
              title="Light mode"
              aria-label="Light mode"
              className={themeMode === 'light' ? 'mode-chip mode-chip-active' : 'mode-chip'}
              onClick={() => setThemeMode('light')}
            >
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
              <span>Light</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={themeMode === 'dark'}
              title="Dark mode"
              aria-label="Dark mode"
              className={themeMode === 'dark' ? 'mode-chip mode-chip-active' : 'mode-chip'}
              onClick={() => setThemeMode('dark')}
            >
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Dark</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          className={editMode ? 'button-secondary button-active' : 'button-secondary'}
          onClick={() => void toggleEditMode()}
          disabled={pending !== null}
        >
          {editMode ? t('widgets.finishEditing') : t('widgets.editLayout')}
        </button>
      </div>

      {view === 'browse' &&
        (categoryPage ? (
          <div className="catalog-page" data-theme-env={themeEnv}>
            <div className="catalog-scroll" key={`page-${categoryPage}-${themeEnv}`}>
              <WidgetCategoryPage
                category={categoryPage}
                builtins={builtins}
                widgets={widgets}
                general={general}
                themeEnv={themeEnv}
                themeMode={themeMode}
                pending={pending}
                onBack={() => setCategoryPage(null)}
                onAdd={(builtin, variant) => void addWidget(builtin, variant)}
                onCustomize={openCustomize}
                onOpenAiStudio={onOpenAiStudio}
              />
            </div>
          </div>
        ) : browseSubView === 'scene' ? (
          <ThemeScene
            themeEnv={themeEnv}
            themeMode={themeMode}
            builtins={builtins}
            general={general}
            query={query}
            categoryFilter={categoryFilter}
            onQueryChange={setQuery}
            onCategoryFilterChange={setCategoryFilter}
            onCustomize={openSceneCustomize}
            onSwitchToCatalog={() => setBrowseSubView('catalog')}
          />
        ) : (
          <div className="catalog-page" data-theme-env={themeEnv}>
            <header className="catalog-head">
              <button
                type="button"
                className="catalog-back"
                onClick={() => setBrowseSubView('scene')}
              >
                <span aria-hidden="true">&larr;</span>
                {t('widgets.backToTheme')}
              </button>

              <div className="catalog-heading">
                <span className="catalog-eyebrow">{t('widgets.themeLabel')}</span>
                <h2>{activeTheme.label}</h2>
                <span className="catalog-designs">
                  {t('widgets.categoryCount', { count: catalogBuiltins.length })}
                </span>
              </div>

              <ExpandableSearch
                className="catalog-search"
                value={query}
                onChange={setQuery}
                label={t('widgets.searchLabel')}
                placeholder={t('widgets.searchPlaceholder')}
                clearLabel={t('widgets.clearSearch')}
              />

              <button type="button" className="catalog-ai-button" onClick={onOpenAiStudio}>
                {t('widgets.createWithAi')}
              </button>
            </header>

            <div
              className="catalog-filter-row"
              role="group"
              aria-label={t('widgets.categoriesLabel')}
            >
              <button
                type="button"
                className={
                  categoryFilter === 'all'
                    ? 'catalog-filter catalog-filter-active'
                    : 'catalog-filter'
                }
                onClick={() => setCategoryFilter('all')}
              >
                {t('widgets.categoryAll')}
              </button>
              {WIDGET_CATEGORIES.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={
                    categoryFilter === category
                      ? 'catalog-filter catalog-filter-active'
                      : 'catalog-filter'
                  }
                  onClick={() => setCategoryFilter(category)}
                >
                  {t(`widgets.categories.${category}`)}
                </button>
              ))}
            </div>

            <div className="catalog-scroll" key={`catalog-${categoryFilter}-${themeEnv}`}>
              <WidgetCatalog
                builtins={catalogBuiltins}
                widgets={widgets}
                general={general}
                themeEnv={themeEnv}
                themeMode={themeMode}
                pending={pending}
                onAdd={(builtin, variant) => void addWidget(builtin, variant)}
                onCustomize={openCustomize}
                onSeeAll={setCategoryPage}
              />
            </div>
          </div>
        ))}

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
                className="button-primary"
                onClick={() => {
                  setView('browse')
                  setBrowseSubView('scene')
                }}
              >
                {t('widgets.addWidget')}
              </button>
            </div>
          </div>

          {widgets.length === 0 ? (
            <div className="empty-state empty-desktop">
              <span className="empty-icon" aria-hidden="true">
                {Array.from({ length: 9 }, (_, index) => (
                  <i key={index} />
                ))}
              </span>
              <strong>{t('widgets.emptyDesktopTitle')}</strong>
              <span>{t('widgets.emptyDesktopBody')}</span>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setView('browse')
                  setBrowseSubView('scene')
                }}
              >
                {t('widgets.browseWidgets')}
              </button>
            </div>
          ) : (
            <DesktopCanvas
              widgets={widgets}
              general={general}
              runtimeById={runtimeById}
              pending={pending}
              onRefresh={onRefresh}
              onCustomize={openCustomizeExisting}
              onVariant={changeVariant}
              onTheme={changeTheme}
              onOpacity={setOpacity}
              onToggleEnabled={toggleEnabled}
              onToggleLocked={toggleLocked}
              onDuplicate={(widgetId) =>
                void run(`duplicate:${widgetId}`, () => window.api.duplicateWidget(widgetId))
              }
              onReload={(widgetId) =>
                void run(`reload:${widgetId}`, () => window.api.reloadWidget(widgetId))
              }
              onRemove={removeWidget}
              onPermission={togglePermission}
              onEditWithAi={onEditWithAi}
              toast={toast}
            />
          )}
        </section>
      )}

      {view === 'saved' && (
        <section className="desktop-panel">
          <div className="desktop-toolbar saved-toolbar">
            <div>
              <h2>{t('widgets.savedTitle')}</h2>
              <p>{t('widgets.savedBody')}</p>
            </div>
            {savedAiWidgets.length > 0 && (
              <div className="saved-toolbar-tools">
                <label className="search-field saved-search">
                  <SearchIcon />
                  <span className="sr-only">{t('widgets.searchSaved')}</span>
                  <input
                    value={savedQuery}
                    onChange={(event) => setSavedQuery(event.target.value)}
                    placeholder={t('widgets.searchPlaceholder')}
                    spellCheck={false}
                  />
                  {savedQuery && (
                    <button
                      type="button"
                      className="search-clear"
                      onClick={() => setSavedQuery('')}
                      aria-label={t('widgets.clearSearch')}
                    >
                      &#10005;
                    </button>
                  )}
                </label>
                <label className="inline-field saved-sort">
                  <span className="sr-only">{t('widgets.sortLabel')}</span>
                  <select
                    value={savedSort}
                    onChange={(event) =>
                      setSavedSort(event.target.value === 'name' ? 'name' : 'newest')
                    }
                  >
                    <option value="newest">{t('widgets.sortNewest')}</option>
                    <option value="name">{t('widgets.sortName')}</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          {savedAiWidgets.length === 0 ? (
            <div className="empty-state empty-saved">
              <span className="empty-icon empty-icon-spark" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <i key={index} />
                ))}
              </span>
              <strong>{t('widgets.emptySavedTitle')}</strong>
              <span>{t('widgets.emptySavedBody')}</span>
              <button type="button" className="button-primary" onClick={onOpenAiStudio}>
                {t('widgets.openAiStudio')}
              </button>
            </div>
          ) : visibleSaved.length === 0 ? (
            <div className="empty-state">
              <strong>{t('widgets.noMatchesTitle')}</strong>
              <span>{t('widgets.noMatchesBody')}</span>
            </div>
          ) : (
            <div className="saved-grid">
              {visibleSaved.map((manifest) => (
                <article className="saved-card" key={manifest.id}>
                  <div className="saved-preview">
                    <WidgetPreview
                      source={{ kind: 'widget', id: manifest.id }}
                      width={manifest.width}
                      height={manifest.height}
                      dark={general.resolvedWidgetTheme === 'dark'}
                      cursorStyle={general.cursor.style}
                      title={manifest.name}
                    />
                  </div>
                  <div className="saved-copy">
                    <div className="saved-title-row">
                      <h3>{manifest.name}</h3>
                      <details className="more-menu">
                        <summary aria-label={t('widgets.moreActions')}>
                          <span aria-hidden="true">&#8943;</span>
                        </summary>
                        <div className="more-menu-panel">
                          <button
                            type="button"
                            className="menu-item menu-item-danger"
                            onClick={() => void deleteAiWidget(manifest.id)}
                            disabled={pending !== null}
                          >
                            {pending === `delete-ai:${manifest.id}`
                              ? t('common.deleting')
                              : t('common.delete')}
                          </button>
                        </div>
                      </details>
                    </div>
                    <span className="meta-line">
                      {t('widgets.dimensions', {
                        width: manifest.width,
                        height: manifest.height
                      })}{' '}
                      &middot; {t('widgets.generated', { date: formatDate(manifest.createdAt) })}
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
                      className="button-quiet button-compact"
                      onClick={() => void addAiWidgetCopy(manifest.id)}
                      disabled={pending !== null || general.safeMode}
                    >
                      {pending === `add-ai:${manifest.id}`
                        ? t('common.adding')
                        : t('widgets.addCopy')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {removalTarget && (
        <ConfirmDialog
          title={t(removalTarget.kind === 'delete' ? 'dialog.deleteTitle' : 'dialog.removeTitle', {
            name: removalTarget.name
          })}
          message={t(
            removalTarget.kind === 'delete' ? 'dialog.deleteMessage' : 'dialog.removeMessage',
            { name: removalTarget.name }
          )}
          detail={
            removalTarget.kind === 'delete'
              ? t('dialog.deleteDetail')
              : widgets.some(
                    (widget) =>
                      widget.placement.widgetId === removalTarget.widgetId &&
                      widget.manifest.kind === 'ai'
                  )
                ? t('dialog.removeAiDetail')
                : t('dialog.removeBuiltinDetail')
          }
          confirmLabel={t(
            removalTarget.kind === 'delete' ? 'dialog.deleteButton' : 'common.remove'
          )}
          cancelLabel={t('common.cancel')}
          pending={pending !== null}
          onConfirm={() => void confirmRemoval()}
          onCancel={() => setRemovalTarget(null)}
        />
      )}

      {customize && (
        <WidgetCustomizeSheet
          builtin={customize.builtin}
          defaultVariant={customize.variant}
          general={general}
          themeEnv={themeEnv}
          themeMode={themeMode}
          themeLabel={activeTheme.label}
          existing={customize.existing}
          onClose={() => setCustomize(null)}
          onSaved={onRefresh}
          toast={toast}
        />
      )}
    </div>
  )
}
