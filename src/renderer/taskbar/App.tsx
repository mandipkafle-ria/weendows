import { useEffect, useMemo, useState, type CSSProperties, type JSX } from 'react'
import type { AppBundleSummary, AppEntry, TaskbarItemRef, TaskbarState } from '../../shared/types'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function AppIcon({ app }: { app: AppEntry | null }): JSX.Element {
  if (app?.iconUrl) {
    return <img className="tb-icon" src={app.iconUrl} alt="" draggable={false} />
  }
  const label = app?.name?.trim().slice(0, 1).toUpperCase() || '?'
  return (
    <span className="tb-fallback" aria-hidden="true">
      {label}
    </span>
  )
}

function TaskbarButton({
  item,
  apps,
  bundles,
  onLaunch,
  onOpenBundle
}: {
  item: TaskbarItemRef
  apps: Map<string, AppEntry>
  bundles: Map<string, AppBundleSummary>
  onLaunch: (appId: string) => void
  onOpenBundle: (bundleId: string, button: HTMLButtonElement) => void
}): JSX.Element {
  if (item.type === 'app') {
    const app = apps.get(item.appId) ?? null
    return (
      <button
        type="button"
        className="tb-item"
        title={app?.name ?? 'Unavailable app'}
        onClick={() => app && onLaunch(app.id)}
        disabled={!app}
      >
        <AppIcon app={app} />
      </button>
    )
  }

  const bundle = bundles.get(item.bundleId)
  return (
    <button
      type="button"
      className="tb-item tb-bundle"
      title={bundle ? `${bundle.name} (${bundle.apps.length})` : 'Unavailable folder'}
      onClick={(event) => bundle && onOpenBundle(bundle.id, event.currentTarget)}
      disabled={!bundle}
    >
      <AppIcon app={bundle?.apps[0] ?? null} />
      {bundle && bundle.apps.length > 1 && <span className="tb-badge">{bundle.apps.length}</span>}
    </button>
  )
}

export default function App(): JSX.Element {
  const [state, setState] = useState<TaskbarState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    void window.taskbarApi
      .getState()
      .then((next) => {
        if (!cancelled) {
          setState(next)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(loadError))
        }
      })
    const off = window.taskbarApi.onState((next) => setState(next))
    return () => {
      cancelled = true
      off()
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!error) {
      return
    }
    const timer = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(timer)
  }, [error])

  const apps = useMemo(
    () => new Map((state?.apps ?? []).map((app) => [app.id, app])),
    [state?.apps]
  )
  const bundles = useMemo(
    () => new Map((state?.bundles ?? []).map((bundle) => [bundle.id, bundle])),
    [state?.bundles]
  )

  const settings = state?.settings
  if (!settings) {
    return <div className="taskbar taskbar-empty-window" />
  }

  const launch = (appId: string): void => {
    void window.taskbarApi.launchApp(appId).catch((launchError: unknown) => {
      setError(errorMessage(launchError))
    })
  }

  const openBundle = (bundleId: string, button: HTMLButtonElement): void => {
    const rect = button.getBoundingClientRect()
    void window.taskbarApi
      .openBundle(bundleId, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      })
      .catch((openError: unknown) => {
        setError(errorMessage(openError))
      })
  }

  const style = {
    '--tb-opacity': settings.opacity
  } as CSSProperties

  return (
    <div
      className="taskbar"
      data-theme={settings.theme}
      data-position={settings.position}
      style={style}
    >
      {settings.showSettingsButton && (
        <button
          type="button"
          className="tb-start"
          title="HomeLayer settings"
          aria-label="Open HomeLayer settings"
          onClick={() => window.taskbarApi.openSettings()}
        >
          <span className="tb-mark" aria-hidden="true" />
        </button>
      )}

      <div className="tb-items">
        {settings.items.length === 0 ? (
          <span className="tb-empty">Pin apps in HomeLayer settings</span>
        ) : (
          settings.items.map((item) => (
            <TaskbarButton
              key={item.type === 'app' ? `app:${item.appId}` : `bundle:${item.bundleId}`}
              item={item}
              apps={apps}
              bundles={bundles}
              onLaunch={launch}
              onOpenBundle={openBundle}
            />
          ))
        )}
      </div>

      <span className="tb-spacer" />

      {settings.showClock && (
        <div className="tb-clock">
          <span className="tb-time">{formatTime(now)}</span>
          <span className="tb-date">{formatDate(now)}</span>
        </div>
      )}

      {error && <div className="tb-error">{error}</div>}
    </div>
  )
}
