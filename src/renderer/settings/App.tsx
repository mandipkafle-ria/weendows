import { useEffect, useState, type JSX } from 'react'
import type { AppInfo, NativeCheckResult } from '../../shared/ipc'

function App(): JSX.Element {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nativeResult, setNativeResult] = useState<NativeCheckResult | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let cancelled = false

    window.api
      .getAppInfo()
      .then((info) => {
        if (!cancelled) {
          setAppInfo(info)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const runNativeCheck = async (): Promise<void> => {
    setChecking(true)
    setNativeResult(null)

    try {
      const result = await window.api.nativeCheck()
      setNativeResult(result)
    } catch (error) {
      setNativeResult({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setChecking(false)
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
