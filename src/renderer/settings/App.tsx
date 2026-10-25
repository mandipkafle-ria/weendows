import { useEffect, useState, type JSX } from 'react'
import type { AppInfo, NativeCheckResult } from '../../shared/ipc'
import type { BuiltinWidget, Notice, WidgetSummary } from '../../shared/types'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function App(): JSX.Element {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [builtins, setBuiltins] = useState<BuiltinWidget[]>([])
  const [widgets, setWidgets] = useState<WidgetSummary[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [editMode, setEditMode] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [nativeResult, setNativeResult] = useState<NativeCheckResult | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        const [info, builtinList, widgetList, editing, noticeList] = await Promise.all([
          window.api.getAppInfo(),
          window.api.getBuiltins(),
          window.api.getWidgets(),
          window.api.getEditMode(),
          window.api.getNotices()
        ])
        if (cancelled) {
          return
        }
        setAppInfo(info)
        setBuiltins(builtinList)
        setWidgets(widgetList)
        setEditMode(editing)
        setNotices(noticeList)
      } catch (error) {
        if (!cancelled) {
          setLoadError(messageOf(error))
        }
      }
    }

    void load()

    const offWidgets = window.api.onWidgetsChanged(() => {
      void window.api
        .getWidgets()
        .then((widgetList) => {
          if (!cancelled) {
            setWidgets(widgetList)
          }
        })
        .catch(() => undefined)
    })
    const offEditMode = window.api.onEditModeChanged((enabled) => {
      if (!cancelled) {
        setEditMode(enabled)
      }
    })
    const offNotices = window.api.onNoticesChanged((noticeList) => {
      if (!cancelled) {
        setNotices(noticeList)
      }
    })

    return () => {
      cancelled = true
      offWidgets()
      offEditMode()
      offNotices()
    }
  }, [])

  const runNativeCheck = async (): Promise<void> => {
    setChecking(true)
    setNativeResult(null)

    try {
      const result = await window.api.nativeCheck()
      setNativeResult(result)
    } catch (error) {
      setNativeResult({ ok: false, error: messageOf(error) })
    } finally {
      setChecking(false)
    }
  }

  const refreshWidgets = async (): Promise<void> => {
    setWidgets(await window.api.getWidgets())
  }

  const addWidget = async (builtinType: string): Promise<void> => {
    setPending(`add:${builtinType}`)
    setActionError(null)
    setStatus(null)

    try {
      const summary = await window.api.addWidget(builtinType)
      await refreshWidgets()
      setStatus(`${summary.manifest.name} added to the desktop.`)
    } catch (error) {
      setActionError(messageOf(error))
    } finally {
      setPending(null)
    }
  }

  const removeWidget = async (widgetId: string): Promise<void> => {
    setPending(`remove:${widgetId}`)
    setActionError(null)
    setStatus(null)

    try {
      const removed = await window.api.removeWidget(widgetId)
      await refreshWidgets()
      setStatus(removed ? 'Widget removed from the desktop.' : 'Removal cancelled.')
    } catch (error) {
      setActionError(messageOf(error))
    } finally {
      setPending(null)
    }
  }

  const toggleEditMode = async (): Promise<void> => {
    setPending('edit-mode')
    setActionError(null)

    try {
      const next = await window.api.setEditMode(!editMode)
      setEditMode(next)
      setStatus(next ? 'Edit mode is on. Drag or resize any widget.' : 'Edit mode is off.')
    } catch (error) {
      setActionError(messageOf(error))
    } finally {
      setPending(null)
    }
  }

  const nativePassed = nativeResult?.ok === true && nativeResult.progmanHandle !== null
  const tickCount = nativeResult !== null && nativeResult.ok ? nativeResult.tickCount : null
  const resultClass = nativeResult ? (nativePassed ? 'status-ok' : 'status-error') : 'status-idle'
  const resultLabel = nativeResult ? (nativePassed ? 'PASS' : 'FAIL') : 'Not run'
  const resultDetail = nativeResult
    ? nativeResult.ok
      ? nativeResult.progmanHandle
        ? `Progman handle: ${nativeResult.progmanHandle}`
        : 'Progman window not found'
      : `Native check failed: ${nativeResult.error}`
    : null

  return (
    <main className="settings">
      <header className="settings-header">
        <div className="brand">
          <span className="brand-dots" aria-hidden="true" />
          <div>
            <h1>HomeLayer</h1>
            <p>Desktop settings</p>
          </div>
        </div>
        <div className="build">
          <span className="build-label">Version</span>
          <span className="build-value">{appInfo?.version ?? '...'}</span>
        </div>
      </header>

      {notices.length > 0 && (
        <section className="notices" aria-live="polite">
          {notices.map((notice) => (
            <div className={`notice notice-${notice.level}`} key={notice.id}>
              {notice.message}
            </div>
          ))}
        </section>
      )}

      <section className="panel panel-wide">
        <div className="section-head">
          <div className="panel-copy">
            <h2>Widget gallery</h2>
            <p>
              Add a built-in widget to the desktop. New widgets appear in the centre of the primary
              display.
            </p>
          </div>
          <span className="section-count">{widgets.length} on desktop</span>
        </div>
        <div className="widget-grid">
          {builtins.map((builtin) => {
            const count = widgets.filter(
              (widget) => widget.manifest.builtinType === builtin.type
            ).length
            const busy = pending === `add:${builtin.type}`
            return (
              <article className="widget-card" key={builtin.type}>
                <div className="widget-card-head">
                  <h3>{builtin.name}</h3>
                  <span className="widget-size">
                    {builtin.width} × {builtin.height}
                  </span>
                </div>
                <p>{builtin.description}</p>
                <div className="widget-card-foot">
                  <span className="widget-count">
                    {count === 0 ? 'Not added' : `${count} on desktop`}
                  </span>
                  <button
                    type="button"
                    onClick={() => void addWidget(builtin.type)}
                    disabled={pending !== null}
                  >
                    {busy ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="section-head">
          <div className="panel-copy">
            <h2>On the desktop</h2>
            <p>Lock a widget to keep it fixed, or remove it from the desktop.</p>
          </div>
        </div>
        {widgets.length === 0 ? (
          <p className="empty">No widgets yet. Add one from the gallery above.</p>
        ) : (
          <ul className="widget-list">
            {widgets.map(({ manifest, placement }) => (
              <li className="widget-row" key={placement.widgetId}>
                <div className="widget-row-copy">
                  <strong>{manifest.name}</strong>
                  <span>
                    {placement.width} × {placement.height} ·{' '}
                    {placement.locked ? 'Locked' : 'Unlocked'} ·{' '}
                    {Math.round(placement.opacity * 100)}%
                  </span>
                </div>
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => void removeWidget(placement.widgetId)}
                  disabled={pending !== null}
                >
                  {pending === `remove:${placement.widgetId}` ? 'Removing...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel panel-wide layout-panel">
        <div className="panel-copy">
          <h2>Desktop layout</h2>
          <p>
            Edit mode adds a dashed border and resize handle to every widget. Drag to move; hold Alt
            while dragging to bypass edge magnetism. Locked widgets cannot be moved.
          </p>
        </div>
        <div className="layout-actions">
          <button
            type="button"
            className={editMode ? 'button-secondary' : ''}
            onClick={() => void toggleEditMode()}
            disabled={pending !== null}
          >
            {pending === 'edit-mode'
              ? 'Please wait...'
              : editMode
                ? 'Finish editing'
                : 'Edit layout'}
          </button>
          <span className="hotkey">Ctrl + Alt + E</span>
        </div>
      </section>

      {(actionError || status) && (
        <p className={actionError ? 'action-message action-error' : 'action-message'} role="status">
          {actionError ?? status}
        </p>
      )}

      <section className="panel">
        <div className="panel-copy">
          <h2>Native check</h2>
          <p>Call user32.dll through koffi and find the Windows Progman window.</p>
        </div>
        <button type="button" onClick={() => void runNativeCheck()} disabled={checking}>
          {checking ? 'Checking...' : 'Native check'}
        </button>
        <div className="native-result" data-testid="native-result" role="status" aria-live="polite">
          <span className={resultClass}>{resultLabel}</span>
          {resultDetail && <span>{resultDetail}</span>}
          {tickCount !== null && <span className="tick">Tick count: {tickCount}</span>}
        </div>
        {loadError && <p className="load-error">Could not read app info: {loadError}</p>}
      </section>

      <footer className="settings-footer">
        <span>HomeLayer is a work in progress.</span>
        <span>{appInfo ? `${appInfo.platform} / ${appInfo.arch}` : ''}</span>
      </footer>
    </main>
  )
}

export default App
