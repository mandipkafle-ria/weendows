import { useEffect, useState, type JSX } from 'react'
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

  useEffect(() => {
    let cancelled = false
    void window.api
      .getAppsAndBundles()
      .then((next) => {
        if (!cancelled) {
          setState(next)
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
      setState(await window.api.refreshApps())
      toast(t('apps.refreshDone'), 'success')
    } catch (refreshError) {
      const message = errorMessage(refreshError)
      setError(message)
      toast(t('apps.scanFailed', { error: message }), 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const visibleApps = state?.apps.filter((entry) => !entry.hidden) ?? []
  const hiddenCount = state?.hiddenCount ?? 0

  return (
    <div className="tab-panel">
      <section className="panel panel-wide">
        <div className="section-head">
          <div className="panel-copy">
            <h2>{t('apps.title')}</h2>
            <p>{t('apps.intro')}</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? t('common.refreshing') : t('apps.refresh')}
          </button>
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
        {error && <p className="load-error">{error}</p>}
        {loading ? (
          <p className="empty">{t('common.loading')}</p>
        ) : visibleApps.length === 0 ? (
          <p className="empty">{t('apps.noApps')}</p>
        ) : (
          <ul className="app-list">
            {visibleApps.map((entry) => (
              <li className="app-row" key={entry.id}>
                <span className="app-name">{entry.name}</span>
                <span className="app-kind">{entry.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel panel-wide">
        <div className="panel-copy">
          <h2>{t('apps.bundlesTitle')}</h2>
          <p>{t('apps.bundlesBody')}</p>
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
                  <strong>{bundle.name}</strong>
                  <span>
                    {t('apps.bundleMeta', {
                      grid: bundle.gridTitle,
                      count: bundle.apps.length
                    })}
                  </span>
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
    </div>
  )
}
