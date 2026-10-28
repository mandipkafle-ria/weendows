import { useEffect, useId, useMemo, useState, type JSX } from 'react'
import type { AppsAndBundlesState } from '../../shared/types'
import { t } from '../i18n'
import type { ToastLevel } from './useToasts'

interface AppsPanelProps {
  toast: (message: string, level?: ToastLevel) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatDate(value: string | null): string {
  if (!value) {
    return t('apps.neverScanned')
  }
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function AppsPanel({ toast }: AppsPanelProps): JSX.Element {
  const [state, setState] = useState<AppsAndBundlesState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [addingAppId, setAddingAppId] = useState<string | null>(null)
  const [addingBundleId, setAddingBundleId] = useState<string | null>(null)
  const [isAddingWidget, setIsAddingWidget] = useState(false)

  // Bundle creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [bundleName, setBundleName] = useState('')
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set())
  const [bundleSearch, setBundleSearch] = useState('')
  const [selectedTargetGridId, setSelectedTargetGridId] = useState<string>('__new__')
  const [creatingBundle, setCreatingBundle] = useState(false)

  // Target widget picker modal for apps & bundles
  const [pickerTarget, setPickerTarget] = useState<{
    type: 'app' | 'bundle'
    id: string
    name: string
  } | null>(null)

  const bundleNameId = useId()
  const bundleSearchId = useId()

  useEffect(() => {
    let cancelled = false
    void window.api
      .getAppsAndBundles()
      .then((next) => {
        if (!cancelled) {
          setState(next)
          const first = next.gridWidgets?.[0]
          if (first) {
            setSelectedTargetGridId(first.widgetId)
          }
          setLoading(false)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(loadError))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = async (): Promise<void> => {
    setRefreshing(true)
    setError(null)
    try {
      const next = await window.api.refreshApps()
      setState(next)
      const first = next.gridWidgets?.[0]
      if (first) {
        setSelectedTargetGridId((prev) => (prev === '__new__' ? first.widgetId : prev))
      }
      toast(t('apps.refreshDone'), 'success')
    } catch (refreshError) {
      const message = errorMessage(refreshError)
      setError(message)
      toast(t('apps.scanFailed', { error: message }), 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const handleAddAppToHomescreen = async (
    appId: string,
    appName: string,
    widgetId?: string
  ): Promise<void> => {
    setAddingAppId(appId)
    try {
      await window.api.addAppToHomescreen(appId, widgetId)
      toast(t('apps.appAddedToGrid', { name: appName }), 'success')
      const next = await window.api.getAppsAndBundles()
      setState(next)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setAddingAppId(null)
    }
  }

  const handleAddBundleToHomescreen = async (
    bundleId: string,
    bName: string,
    widgetId?: string
  ): Promise<void> => {
    setAddingBundleId(bundleId)
    try {
      await window.api.addBundleToHomescreen(bundleId, widgetId)
      toast(t('apps.addedToHomescreen', { name: bName }), 'success')
      const next = await window.api.getAppsAndBundles()
      setState(next)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setAddingBundleId(null)
    }
  }

  const onAddAppClick = (appId: string, appName: string): void => {
    if (state?.gridWidgets && state.gridWidgets.length > 1) {
      setPickerTarget({ type: 'app', id: appId, name: appName })
    } else {
      const targetId = state?.gridWidgets?.[0]?.widgetId
      void handleAddAppToHomescreen(appId, appName, targetId)
    }
  }

  const onAddBundleClick = (bundleId: string, bName: string): void => {
    if (state?.gridWidgets && state.gridWidgets.length > 1) {
      setPickerTarget({ type: 'bundle', id: bundleId, name: bName })
    } else {
      const targetId = state?.gridWidgets?.[0]?.widgetId
      void handleAddBundleToHomescreen(bundleId, bName, targetId)
    }
  }

  const handleDeleteBundle = async (bundleId: string, bName: string): Promise<void> => {
    if (!window.confirm(t('apps.deleteBundleConfirm', { name: bName }))) {
      return
    }
    try {
      const next = await window.api.deleteBundle(bundleId)
      setState(next)
      toast(t('apps.bundleDeleted', { name: bName }), 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const handleAddAppsWidget = async (): Promise<void> => {
    setIsAddingWidget(true)
    try {
      await window.api.addWidget('app-grid')
      toast(t('widgets.added', { name: 'Apps' }), 'success')
      const next = await window.api.getAppsAndBundles()
      setState(next)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setIsAddingWidget(false)
    }
  }

  const openCreateModal = (): void => {
    setSelectedTargetGridId(state?.gridWidgets?.[0]?.widgetId || '__new__')
    setBundleName('')
    setSelectedAppIds(new Set())
    setBundleSearch('')
    setShowCreateModal(true)
  }

  const handleCreateBundle = async (): Promise<void> => {
    const trimmedName = bundleName.trim()
    if (!trimmedName) {
      toast(t('apps.bundleNamePlaceholder'), 'info')
      return
    }
    if (selectedAppIds.size === 0) {
      toast(t('apps.selectApps'), 'info')
      return
    }
    setCreatingBundle(true)
    try {
      const next = await window.api.createBundle(
        trimmedName,
        Array.from(selectedAppIds),
        selectedTargetGridId
      )
      setState(next)
      setShowCreateModal(false)
      setBundleName('')
      setSelectedAppIds(new Set())
      toast(t('apps.bundleCreated', { name: trimmedName }), 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setCreatingBundle(false)
    }
  }

  const toggleSelectApp = (appId: string): void => {
    setSelectedAppIds((prev) => {
      const next = new Set(prev)
      if (next.has(appId)) {
        next.delete(appId)
      } else {
        next.add(appId)
      }
      return next
    })
  }

  const visibleApps = useMemo(
    () => state?.apps.filter((entry) => !entry.hidden) ?? [],
    [state?.apps]
  )

  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return visibleApps
    return visibleApps.filter((app) => app.name.toLowerCase().includes(query))
  }, [visibleApps, searchQuery])

  const modalFilteredApps = useMemo(() => {
    const query = bundleSearch.trim().toLowerCase()
    if (!query) return visibleApps
    return visibleApps.filter((app) => app.name.toLowerCase().includes(query))
  }, [visibleApps, bundleSearch])

  const hiddenCount = state?.hiddenCount ?? 0

  return (
    <div className="tab-panel">
      {/* Top action row */}
      <section className="panel panel-wide">
        <div className="section-head">
          <div className="panel-copy">
            <h2>{t('apps.title')}</h2>
            <p>{t('apps.intro')}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button-primary"
              onClick={() => void handleAddAppsWidget()}
              disabled={isAddingWidget}
            >
              {isAddingWidget ? t('common.loading') : `+ ${t('apps.addGridWidget')}`}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setShowCreateModal(true)
                setBundleName('')
                setSelectedAppIds(new Set())
              }}
            >
              + {t('apps.createBundle')}
            </button>
            <button
              type="button"
              className="button-quiet"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              {refreshing ? t('common.refreshing') : t('apps.refresh')}
            </button>
          </div>
        </div>

        <div className="stat-strip">
          <span className="stat-chip">{t('apps.appsCount', { count: visibleApps.length })}</span>
          <span className="stat-chip">{t('apps.hiddenCount', { count: hiddenCount })}</span>
          <span className="stat-chip">
            {t('apps.bundlesCount', { count: state?.bundles.length ?? 0 })}
          </span>
          <span className="stat-chip">
            {state?.scanning
              ? t('apps.scanning')
              : t('apps.lastScan', { date: formatDate(state?.lastScanAt ?? null) })}
          </span>
        </div>
      </section>

      {/* Discovered Apps List */}
      <section className="panel panel-wide">
        <div
          className="section-head"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div className="panel-copy">
            <h2>{t('apps.appsTitle')}</h2>
            <p>{t('apps.appsBody')}</p>
          </div>
          <div style={{ width: '220px' }}>
            <input
              type="search"
              placeholder={t('apps.searchApps')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search"
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: '11px'
              }}
            />
          </div>
        </div>

        {error && <p className="load-error">{error}</p>}
        {loading ? (
          <p className="empty">{t('common.loading')}</p>
        ) : filteredApps.length === 0 ? (
          <p className="empty">{searchQuery ? t('widgets.noMatchesTitle') : t('apps.noApps')}</p>
        ) : (
          <ul className="app-list">
            {filteredApps.map((entry) => (
              <li className="app-row" key={entry.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span className="app-name">{entry.name}</span>
                  <span className="app-kind">{entry.kind}</span>
                </div>
                <button
                  type="button"
                  className="button-compact button-secondary"
                  onClick={() => onAddAppClick(entry.id, entry.name)}
                  disabled={addingAppId === entry.id}
                  title={t('apps.addToHomescreen')}
                >
                  {addingAppId === entry.id ? '…' : `+ ${t('apps.addToHomescreen')}`}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bundles / Folders Section */}
      <section className="panel panel-wide">
        <div
          className="section-head"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div className="panel-copy">
            <h2>{t('apps.bundlesTitle')}</h2>
            <p>{t('apps.bundlesBody')}</p>
          </div>
          <button type="button" className="button-secondary" onClick={openCreateModal}>
            + {t('apps.createBundle')}
          </button>
        </div>

        {loading ? (
          <p className="empty">{t('common.loading')}</p>
        ) : (state?.bundles.length ?? 0) === 0 ? (
          <p className="empty">{t('apps.noBundles')}</p>
        ) : (
          <ul className="bundle-list">
            {state?.bundles.map((bundle) => (
              <li className="bundle-row" key={bundle.id}>
                <div className="bundle-head">
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong>{bundle.name}</strong>
                    <span>
                      {t('apps.bundleMeta', {
                        grid: bundle.gridTitle,
                        count: bundle.apps.length
                      })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="button-compact button-secondary"
                      onClick={() => onAddBundleClick(bundle.id, bundle.name)}
                      disabled={addingBundleId === bundle.id}
                      title={t('apps.addToHomescreen')}
                    >
                      {addingBundleId === bundle.id ? '…' : `+ ${t('apps.addToHomescreen')}`}
                    </button>
                    <button
                      type="button"
                      className="button-compact button-danger"
                      onClick={() => void handleDeleteBundle(bundle.id, bundle.name)}
                      title={t('apps.deleteBundle')}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="bundle-apps">
                  {bundle.apps.map((entry) => (
                    <span className="bundle-chip" key={entry.id}>
                      {entry.name}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create Bundle Modal Dialog */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              width: 'min(520px, 92vw)',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--panel)',
              border: '1px solid var(--border-focus)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
              gap: '16px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text)' }}>
                {t('apps.createBundleTitle')}
              </h3>
              <button
                type="button"
                className="button-quiet button-compact"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor={bundleNameId}
                style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}
              >
                {t('apps.bundleName')}
              </label>
              <input
                id={bundleNameId}
                type="text"
                placeholder={t('apps.bundleNamePlaceholder')}
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                maxLength={24}
                autoFocus
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--panel-soft)',
                  color: 'var(--text)',
                  fontSize: '13px'
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flex: 1,
                minHeight: 0
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <label
                  htmlFor={bundleSearchId}
                  style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}
                >
                  {t('apps.selectApps')} ({selectedAppIds.size})
                </label>
                <input
                  id={bundleSearchId}
                  type="search"
                  placeholder={t('apps.searchApps')}
                  value={bundleSearch}
                  onChange={(e) => setBundleSearch(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel-soft)',
                    color: 'var(--text)',
                    fontSize: '11px',
                    width: '160px'
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  background: 'var(--panel-soft)',
                  padding: '6px'
                }}
              >
                {modalFilteredApps.length === 0 ? (
                  <p className="empty" style={{ margin: '14px 0', fontSize: '11px' }}>
                    {t('widgets.noMatchesTitle')}
                  </p>
                ) : (
                  modalFilteredApps.map((app) => {
                    const isChecked = selectedAppIds.has(app.id)
                    return (
                      <label
                        key={app.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isChecked ? 'var(--panel-active)' : 'transparent',
                          transition: 'background 120ms ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectApp(app.id)}
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1 }}>
                          {app.name}
                        </span>
                        <span
                          style={{
                            fontSize: '9.5px',
                            color: 'var(--faint)',
                            textTransform: 'uppercase'
                          }}
                        >
                          {app.kind}
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="target-widget-select"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text)'
                }}
              >
                {t('apps.targetWidget')}
              </label>
              <select
                id="target-widget-select"
                value={selectedTargetGridId}
                onChange={(e) => setSelectedTargetGridId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  color: 'var(--text)',
                  fontSize: '12px'
                }}
              >
                {state?.gridWidgets && state.gridWidgets.length > 0
                  ? state.gridWidgets.map((w) => (
                      <option key={w.widgetId} value={w.widgetId}>
                        {w.title} ({w.widgetId})
                      </option>
                    ))
                  : null}
                <option value="__new__">{t('apps.createNewWidget')}</option>
                <option value="none">{t('apps.libraryOnly')}</option>
              </select>
            </div>

            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}
            >
              <button
                type="button"
                className="button-quiet"
                onClick={() => setShowCreateModal(false)}
                disabled={creatingBundle}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => void handleCreateBundle()}
                disabled={creatingBundle || selectedAppIds.size === 0 || !bundleName.trim()}
              >
                {creatingBundle ? t('common.loading') : t('apps.createBundle')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Widget Choice Modal for Apps & Bundles */}
      {pickerTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPickerTarget(null)
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--panel-solid)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
            }}
          >
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text)' }}>
                {t('apps.chooseWidgetTitle')}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 0' }}>
                {t('apps.chooseWidgetDesc', { name: pickerTarget.name })}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {state?.gridWidgets?.map((gw) => (
                <button
                  key={gw.widgetId}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease'
                  }}
                  onClick={() => {
                    if (pickerTarget.type === 'app') {
                      void handleAddAppToHomescreen(pickerTarget.id, pickerTarget.name, gw.widgetId)
                    } else {
                      void handleAddBundleToHomescreen(
                        pickerTarget.id,
                        pickerTarget.name,
                        gw.widgetId
                      )
                    }
                    setPickerTarget(null)
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{gw.title}</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--faint)' }}>{gw.widgetId}</span>
                </button>
              ))}

              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px dashed var(--accent)',
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (pickerTarget.type === 'app') {
                    void handleAddAppToHomescreen(pickerTarget.id, pickerTarget.name, '__new__')
                  } else {
                    void handleAddBundleToHomescreen(pickerTarget.id, pickerTarget.name, '__new__')
                  }
                  setPickerTarget(null)
                }}
              >
                {t('apps.createNewWidget')}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button type="button" className="button-quiet" onClick={() => setPickerTarget(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
