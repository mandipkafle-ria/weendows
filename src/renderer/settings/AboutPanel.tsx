import { useEffect, useState, type JSX } from 'react'
import type { NativeCheckResult } from '../../shared/ipc'
import type { GeneralState } from '../../shared/types'
import { t } from '../i18n'
import type { ToastLevel } from './useToasts'

const ISSUE_TRACKER_URL = 'https://github.com/mandipkafle-ria/weendows/issues'

interface AboutPanelProps {
  general: GeneralState
  toast: (message: string, level?: ToastLevel) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function AboutPanel({ general, toast }: AboutPanelProps): JSX.Element {
  const [licenses, setLicenses] = useState<string | null>(null)
  const [licenseError, setLicenseError] = useState<string | null>(null)
  const [nativeResult, setNativeResult] = useState<NativeCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [pendingLink, setPendingLink] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.api
      .getLicenses()
      .then((text) => {
        if (!cancelled) {
          setLicenses(text)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLicenseError(errorMessage(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const runNativeCheck = async (): Promise<void> => {
    setChecking(true)
    try {
      setNativeResult(await window.api.nativeCheck())
    } catch (error) {
      setNativeResult({ ok: false, error: errorMessage(error) })
    } finally {
      setChecking(false)
    }
  }

  const restoreWallpaper = async (): Promise<void> => {
    setRestoring(true)
    try {
      await window.api.restoreOriginalWallpaper()
      toast(t('about.restored'), 'success')
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setRestoring(false)
    }
  }

  const openIssueTracker = async (): Promise<void> => {
    setPendingLink(true)
    try {
      await window.api.openExternal(ISSUE_TRACKER_URL)
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPendingLink(false)
    }
  }

  const nativePassed = nativeResult?.ok === true && nativeResult.progmanHandle !== null
  const nativeDetail = nativeResult
    ? nativeResult.ok
      ? nativeResult.progmanHandle
        ? t('about.nativeProgman', { handle: nativeResult.progmanHandle })
        : t('about.nativeNoProgman')
      : t('about.nativeFailed', { error: nativeResult.error })
    : null

  return (
    <div className="tab-panel">
      <section className="panel panel-wide about-hero">
        <div>
          <span className="eyebrow">{t('app.name')}</span>
          <h2>{t('about.title')}</h2>
          <p>{t('about.intro')}</p>
        </div>
        <div className="about-version">
          <strong>{t('about.version', { version: general.version })}</strong>
          <span>{t('about.builtFor', { platform: general.platform, arch: general.arch })}</span>
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="section-head">
          <div className="panel-copy">
            <h2>{t('about.restoreTitle')}</h2>
            <p>{t('about.restoreBody')}</p>
          </div>
          <button type="button" onClick={() => void restoreWallpaper()} disabled={restoring}>
            {restoring ? t('common.saving') : t('about.restore')}
          </button>
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="section-head">
          <div className="panel-copy">
            <h2>{t('about.issueTitle')}</h2>
            <p>{t('about.issueBody')}</p>
          </div>
          <button type="button" onClick={() => void openIssueTracker()} disabled={pendingLink}>
            {t('about.issueLink')}
          </button>
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="panel-copy">
          <h2>{t('about.licensesTitle')}</h2>
          <p>{t('about.licensesBody')}</p>
        </div>
        {licenseError ? (
          <p className="load-error">{t('about.licenseLoadFailed', { error: licenseError })}</p>
        ) : licenses === null ? (
          <p className="empty">{t('common.loading')}</p>
        ) : (
          <details className="license-details">
            <summary>{t('about.licensesTitle')}</summary>
            <pre>{licenses}</pre>
          </details>
        )}
      </section>

      <section className="panel panel-wide">
        <div className="section-head">
          <div className="panel-copy">
            <h2>{t('about.nativeTitle')}</h2>
            <p>{t('about.nativeBody')}</p>
          </div>
          <button type="button" onClick={() => void runNativeCheck()} disabled={checking}>
            {checking ? t('common.checking') : t('about.nativeButton')}
          </button>
        </div>
        <div className="native-result" role="status" aria-live="polite">
          <span
            className={nativeResult ? (nativePassed ? 'status-ok' : 'status-error') : 'status-idle'}
          >
            {nativeResult
              ? nativePassed
                ? t('common.pass')
                : t('common.fail')
              : t('common.notRun')}
          </span>
          {nativeDetail && <span>{nativeDetail}</span>}
          {nativeResult?.ok && (
            <span className="tick">{t('about.tickCount', { count: nativeResult.tickCount })}</span>
          )}
        </div>
      </section>
    </div>
  )
}
