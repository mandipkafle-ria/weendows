import { useEffect, useMemo, useState, type JSX } from 'react'
import type {
  AppEntry,
  TaskbarItemRef,
  TaskbarSettingsFile,
  TaskbarSettingsPatch,
  TaskbarState
} from '../../shared/types'
import { t } from '../i18n'
import type { ToastLevel } from './useToasts'

interface TaskbarPanelProps {
  toast: (message: string, level?: ToastLevel) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function itemKey(item: TaskbarItemRef): string {
  return item.type === 'app' ? `app:${item.appId}` : `bundle:${item.bundleId}`
}

function PinIcon({ app }: { app: AppEntry | null }): JSX.Element {
  if (app?.iconUrl) {
    return <img src={app.iconUrl} alt="" draggable={false} />
  }
  return <span>{app?.name?.trim().slice(0, 1).toUpperCase() || '?'}</span>
}

function matches(query: string, name: string): boolean {
  return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
}

export default function TaskbarPanel({ toast }: TaskbarPanelProps): JSX.Element {
  const [state, setState] = useState<TaskbarState | null>(null)
  const [draft, setDraft] = useState<TaskbarSettingsFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [picker, setPicker] = useState<'apps' | 'bundles'>('apps')

  useEffect(() => {
    let cancelled = false
    void window.api
      .getTaskbarState()
      .then((next) => {
        if (!cancelled) {
          setState(next)
          setDraft(next.settings)
          setLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast(errorMessage(error), 'error')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  useEffect(() => {
    const off = window.api.onTaskbarChanged((next) => {
      setState(next)
      if (!busy) {
        setDraft(next.settings)
      }
    })
    return off
  }, [busy])

  const settings = draft ?? state?.settings ?? null

  const apps = useMemo(
    () =>
      [...(state?.apps ?? [])]
        .filter((app) => !app.hidden)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [state?.apps]
  )
  const bundles = useMemo(
    () => [...(state?.bundles ?? [])].sort((left, right) => left.name.localeCompare(right.name)),
    [state?.bundles]
  )
  const appsById = useMemo(() => new Map(apps.map((app) => [app.id, app])), [apps])
  const bundlesById = useMemo(
    () => new Map(bundles.map((bundle) => [bundle.id, bundle])),
    [bundles]
  )

  const applyPatch = async (
    patch: TaskbarSettingsPatch,
    successMessage?: string
  ): Promise<void> => {
    setBusy(true)
    try {
      const next = await window.api.updateTaskbar(patch)
      setState(next)
      setDraft(next.settings)
      if (successMessage) {
        toast(successMessage, 'success')
      }
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const localPatch = (patch: Partial<TaskbarSettingsFile>): void => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  if (loading || !settings || !state) {
    return (
      <div className="tab-panel">
        <p className="empty">{t('common.loading')}</p>
      </div>
    )
  }

  const pinned = new Set(settings.items.map(itemKey))
  const filteredApps = apps.filter(
    (app) => !pinned.has(`app:${app.id}`) && matches(query, app.name)
  )
  const filteredBundles = bundles.filter(
    (bundle) => !pinned.has(`bundle:${bundle.id}`) && matches(query, bundle.name)
  )

  const setItems = (items: TaskbarItemRef[]): void => {
    localPatch({ items })
    void applyPatch({ items })
  }

  const addItem = (item: TaskbarItemRef): void => {
    if (settings.items.length >= 32) {
      toast(t('taskbar.limit'), 'error')
      return
    }
    setItems([...settings.items, item])
  }

  const removeItem = (index: number): void => {
    setItems(settings.items.filter((_item, itemIndex) => itemIndex !== index))
  }

  const moveItem = (index: number, offset: number): void => {
    const target = index + offset
    if (target < 0 || target >= settings.items.length) {
      return
    }
    const items = [...settings.items]
    const [item] = items.splice(index, 1)
    if (!item) {
      return
    }
    items.splice(target, 0, item)
    setItems(items)
  }

  const commitNumber = (key: 'opacity' | 'height', value: number): void => {
    void applyPatch(key === 'opacity' ? { opacity: value } : { height: value })
  }

  const resolveItem = (
    item: TaskbarItemRef
  ): { name: string; detail: string; app: AppEntry | null } => {
    if (item.type === 'app') {
      const app = appsById.get(item.appId) ?? null
      return {
        name: app?.name ?? t('taskbar.unavailable'),
        detail: t('taskbar.app'),
        app
      }
    }
    const bundle = bundlesById.get(item.bundleId) ?? null
    return {
      name: bundle?.name ?? t('taskbar.unavailable'),
      detail: bundle
        ? t('taskbar.bundleCount', { count: bundle.apps.length })
        : t('taskbar.unavailable'),
      app: bundle?.apps[0] ?? null
    }
  }

  const previewItems = settings.items.slice(0, 8)

  return (
    <div className="tab-panel taskbar-panel">
      <section className="panel panel-wide">
        <div className="panel-copy">
          <h2>{t('taskbar.enableTitle')}</h2>
          <p>{t('taskbar.enableBody')}</p>
        </div>
        <div className="setting-row">
          <div>
            <strong>{t('taskbar.enable')}</strong>
            <span>{t('taskbar.enableHint')}</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={settings.enabled}
              disabled={busy}
              onChange={(event) => {
                localPatch({ enabled: event.target.checked })
                void applyPatch({ enabled: event.target.checked })
              }}
            />
            <span aria-hidden="true" />
          </label>
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="panel-copy">
          <h2>{t('taskbar.modeTitle')}</h2>
          <p>{t('taskbar.modeBody')}</p>
        </div>
        <div className="taskbar-mode-grid" role="radiogroup" aria-label={t('taskbar.modeTitle')}>
          <button
            type="button"
            role="radio"
            aria-checked={settings.mode === 'overlay'}
            className={
              settings.mode === 'overlay' ? 'taskbar-mode taskbar-mode-active' : 'taskbar-mode'
            }
            disabled={busy}
            onClick={() => {
              localPatch({ mode: 'overlay' })
              void applyPatch({ mode: 'overlay' })
            }}
          >
            <strong>{t('taskbar.modeOverlay')}</strong>
            <span>{t('taskbar.modeOverlayBody')}</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.mode === 'replace'}
            className={
              settings.mode === 'replace' ? 'taskbar-mode taskbar-mode-active' : 'taskbar-mode'
            }
            disabled={busy}
            onClick={() => {
              localPatch({ mode: 'replace' })
              void applyPatch({ mode: 'replace' })
            }}
          >
            <strong>{t('taskbar.modeReplace')}</strong>
            <span>{t('taskbar.modeReplaceBody')}</span>
          </button>
        </div>
        {settings.mode === 'replace' && (
          <p
            className={
              state.systemTaskbarHidden ? 'taskbar-status taskbar-status-ok' : 'taskbar-status'
            }
          >
            {state.nativeError
              ? t('taskbar.nativeError', { error: state.nativeError })
              : state.systemTaskbarHidden
                ? t('taskbar.hidden')
                : t('taskbar.hiddenPending')}
          </p>
        )}
        {settings.mode === 'replace' && <p className="field-hint">{t('taskbar.replaceWarning')}</p>}
      </section>

      <section className="panel panel-wide">
        <div className="panel-copy">
          <h2>{t('taskbar.appearanceTitle')}</h2>
          <p>{t('taskbar.appearanceBody')}</p>
        </div>

        <div className="taskbar-preview-wrap">
          <span className="taskbar-preview-label">{t('taskbar.preview')}</span>
          <div
            className={`taskbar-preview taskbar-preview-${settings.theme}`}
            data-position={settings.position}
            style={{ opacity: settings.opacity, height: `${Math.min(settings.height, 58)}px` }}
          >
            {settings.showSettingsButton && (
              <span className="taskbar-preview-start" aria-hidden="true">
                <span />
              </span>
            )}
            <div className="taskbar-preview-items">
              {previewItems.map((item) => {
                const resolved = resolveItem(item)
                return (
                  <span className="taskbar-preview-item" key={itemKey(item)} title={resolved.name}>
                    <PinIcon app={resolved.app} />
                  </span>
                )
              })}
            </div>
            <span className="taskbar-preview-spacer" />
            {settings.showClock && (
              <span className="taskbar-preview-clock">
                <strong>9:41</strong>
                <small>Oct 30</small>
              </span>
            )}
          </div>
        </div>

        <div className="appearance-group">
          <div className="appearance-label">
            <strong>{t('taskbar.position')}</strong>
            <span>{t('taskbar.positionHint')}</span>
          </div>
          <div className="segmented-control" role="radiogroup" aria-label={t('taskbar.position')}>
            {(
              [
                ['bottom', t('taskbar.positionBottom')],
                ['top', t('taskbar.positionTop')]
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                aria-checked={settings.position === value}
                className={settings.position === value ? 'segment-active' : ''}
                key={value}
                disabled={busy}
                onClick={() => {
                  localPatch({ position: value })
                  void applyPatch({ position: value })
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="appearance-group">
          <div className="appearance-label">
            <strong>{t('taskbar.theme')}</strong>
            <span>{t('taskbar.themeHint')}</span>
          </div>
          <div className="segmented-control" role="radiogroup" aria-label={t('taskbar.theme')}>
            {(
              [
                ['dark', t('taskbar.themeDark')],
                ['light', t('taskbar.themeLight')],
                ['accent', t('taskbar.themeAccent')],
                ['glass', t('taskbar.themeGlass')]
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                aria-checked={settings.theme === value}
                className={settings.theme === value ? 'segment-active' : ''}
                key={value}
                disabled={busy}
                onClick={() => {
                  localPatch({ theme: value })
                  void applyPatch({ theme: value })
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="taskbar-sliders">
          <label className="taskbar-slider">
            <span>
              {t('taskbar.opacity')}
              <strong>{Math.round(settings.opacity * 100)}%</strong>
            </span>
            <input
              type="range"
              min={35}
              max={100}
              step={1}
              value={Math.round(settings.opacity * 100)}
              disabled={busy}
              onChange={(event) => localPatch({ opacity: Number(event.target.value) / 100 })}
              onPointerUp={(event) =>
                commitNumber('opacity', Number(event.currentTarget.value) / 100)
              }
              onKeyUp={(event) => commitNumber('opacity', Number(event.currentTarget.value) / 100)}
            />
          </label>
          <label className="taskbar-slider">
            <span>
              {t('taskbar.height')}
              <strong>{settings.height}px</strong>
            </span>
            <input
              type="range"
              min={36}
              max={72}
              step={2}
              value={settings.height}
              disabled={busy}
              onChange={(event) => localPatch({ height: Number(event.target.value) })}
              onPointerUp={(event) => commitNumber('height', Number(event.currentTarget.value))}
              onKeyUp={(event) => commitNumber('height', Number(event.currentTarget.value))}
            />
          </label>
        </div>

        <div className="taskbar-toggle-row">
          <label className="taskbar-check">
            <input
              type="checkbox"
              checked={settings.showClock}
              disabled={busy}
              onChange={(event) => {
                localPatch({ showClock: event.target.checked })
                void applyPatch({ showClock: event.target.checked })
              }}
            />
            <span>{t('taskbar.showClock')}</span>
          </label>
          <label className="taskbar-check">
            <input
              type="checkbox"
              checked={settings.showSettingsButton}
              disabled={busy}
              onChange={(event) => {
                localPatch({ showSettingsButton: event.target.checked })
                void applyPatch({ showSettingsButton: event.target.checked })
              }}
            />
            <span>{t('taskbar.showSettingsButton')}</span>
          </label>
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="panel-copy">
          <h2>{t('taskbar.pinsTitle')}</h2>
          <p>{t('taskbar.pinsBody')}</p>
        </div>

        {settings.items.length === 0 ? (
          <p className="empty">{t('taskbar.empty')}</p>
        ) : (
          <ul className="taskbar-pin-list">
            {settings.items.map((item, index) => {
              const resolved = resolveItem(item)
              return (
                <li className="taskbar-pin-row" key={itemKey(item)}>
                  <span className="taskbar-pin-icon">
                    <PinIcon app={resolved.app} />
                  </span>
                  <span className="taskbar-pin-name">
                    <strong>{resolved.name}</strong>
                    <span>{resolved.detail}</span>
                  </span>
                  <button
                    type="button"
                    className="taskbar-icon-button"
                    title={t('taskbar.moveUp')}
                    aria-label={t('taskbar.moveUp')}
                    disabled={index === 0 || busy}
                    onClick={() => moveItem(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="taskbar-icon-button"
                    title={t('taskbar.moveDown')}
                    aria-label={t('taskbar.moveDown')}
                    disabled={index === settings.items.length - 1 || busy}
                    onClick={() => moveItem(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="button-compact button-danger"
                    disabled={busy}
                    onClick={() => removeItem(index)}
                  >
                    {t('common.remove')}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="taskbar-picker">
          <div className="taskbar-picker-head">
            <div className="segmented-control" role="tablist" aria-label={t('taskbar.pickerLabel')}>
              <button
                type="button"
                role="tab"
                aria-selected={picker === 'apps'}
                className={picker === 'apps' ? 'segment-active' : ''}
                onClick={() => setPicker('apps')}
              >
                {t('taskbar.apps')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={picker === 'bundles'}
                className={picker === 'bundles' ? 'segment-active' : ''}
                onClick={() => setPicker('bundles')}
              >
                {t('taskbar.bundles')}
              </button>
            </div>
            <input
              type="search"
              className="taskbar-search"
              placeholder={t('taskbar.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {picker === 'apps' ? (
            filteredApps.length === 0 ? (
              <p className="empty">{t('taskbar.noMatches')}</p>
            ) : (
              <ul className="taskbar-picker-list">
                {filteredApps.map((app) => (
                  <li key={app.id}>
                    <span className="taskbar-pin-icon">
                      <PinIcon app={app} />
                    </span>
                    <span className="taskbar-pin-name">
                      <strong>{app.name}</strong>
                      <span>{app.kind}</span>
                    </span>
                    <button
                      type="button"
                      className="button-compact button-secondary"
                      disabled={busy}
                      onClick={() => addItem({ type: 'app', appId: app.id })}
                    >
                      + {t('taskbar.pin')}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : filteredBundles.length === 0 ? (
            <p className="empty">{t('taskbar.noMatches')}</p>
          ) : (
            <ul className="taskbar-picker-list">
              {filteredBundles.map((bundle) => (
                <li key={bundle.id}>
                  <span className="taskbar-pin-icon">
                    <PinIcon app={bundle.apps[0] ?? null} />
                  </span>
                  <span className="taskbar-pin-name">
                    <strong>{bundle.name}</strong>
                    <span>{t('taskbar.bundleCount', { count: bundle.apps.length })}</span>
                  </span>
                  <button
                    type="button"
                    className="button-compact button-secondary"
                    disabled={busy}
                    onClick={() => addItem({ type: 'bundle', bundleId: bundle.id })}
                  >
                    + {t('taskbar.pin')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
