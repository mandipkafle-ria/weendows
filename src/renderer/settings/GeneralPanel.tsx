import { useEffect, useState, type JSX } from 'react'
import { acceleratorFromKeyEvent, acceleratorLabel } from '../../shared/hotkeys'
import type { AccentColor, GeneralState, ThemeSource } from '../../shared/types'
import { ACCENT_COLORS } from '../../shared/types'
import { t } from '../i18n'
import CursorGallery from './CursorGallery'
import type { ToastLevel } from './useToasts'

const ACCENT_LABEL_KEYS: Record<AccentColor, string> = {
  ember: 'general.accentEmber',
  violet: 'general.accentViolet',
  teal: 'general.accentTeal',
  rose: 'general.accentRose'
}

function ThemeIcon({ mode }: { mode: ThemeSource }): JSX.Element {
  const common = {
    className: 'segment-icon',
    viewBox: '0 0 24 24',
    width: 13,
    height: 13,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }

  if (mode === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.1M12 19.3v2.1M4.3 4.3l1.5 1.5M18.2 18.2l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.3 19.7l1.5-1.5M18.2 5.8l1.5-1.5" />
      </svg>
    )
  }

  if (mode === 'system') {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M9 20h6M12 16v4" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2z" />
    </svg>
  )
}

interface GeneralPanelProps {
  general: GeneralState
  onGeneral: (general: GeneralState) => void
  toast: (message: string, level?: ToastLevel) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function GeneralPanel({
  general,
  onGeneral,
  toast
}: GeneralPanelProps): JSX.Element {
  const [recording, setRecording] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) {
      return
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      const accelerator = acceleratorFromKeyEvent(event)
      if (!accelerator) {
        if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
          toast(t('general.hotkeyNeedModifier'), 'error')
        }
        return
      }

      setRecording(false)
      setPending('hotkey')
      void window.api
        .setHotkey(accelerator)
        .then((next) => {
          onGeneral(next)
          toast(t('general.hotkeySaved', { hotkey: acceleratorLabel(accelerator) }), 'success')
        })
        .catch(() => {
          toast(t('general.hotkeyFailed', { hotkey: acceleratorLabel(accelerator) }), 'error')
        })
        .finally(() => setPending(null))
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, onGeneral, toast])

  const setTheme = async (theme: ThemeSource): Promise<void> => {
    setPending('theme')
    try {
      onGeneral(await window.api.setTheme(theme))
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const setAccent = async (accent: AccentColor): Promise<void> => {
    setPending('accent')
    try {
      onGeneral(await window.api.setAccent(accent))
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const setWidgetDefaultTheme = async (theme: ThemeSource): Promise<void> => {
    setPending('widget-theme')
    try {
      onGeneral(await window.api.setWidgetDefaultTheme(theme))
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const setStartWithWindows = async (enabled: boolean): Promise<void> => {
    setPending('login')
    try {
      onGeneral(await window.api.setStartWithWindows(enabled))
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const resetLayout = async (): Promise<void> => {
    if (!window.confirm(t('general.resetConfirm'))) {
      toast(t('general.resetCancel'))
      return
    }
    setPending('reset')
    try {
      await window.api.resetLayout()
      toast(t('general.resetDone'), 'success')
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const openDataFolder = async (): Promise<void> => {
    setPending('data-folder')
    try {
      await window.api.openDataFolder()
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  const exportDiagnostics = async (): Promise<void> => {
    setPending('diagnostics')
    try {
      const result = await window.api.exportDiagnostics()
      toast(t('general.diagnosticsDone', { folder: result.folder }), 'success')
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="tab-panel">
      <section className="panel panel-wide">
        <div className="panel-copy">
          <h2>{t('general.startupTitle')}</h2>
          <p>{t('general.intro')}</p>
        </div>
        <div className="setting-row">
          <div>
            <strong>{t('general.startWithWindows')}</strong>
            <span>
              {general.loginItemAvailable
                ? t('general.startWithWindowsHint')
                : t('general.startWithWindowsDev')}
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={general.loginItemEnabled}
              disabled={!general.loginItemAvailable || pending !== null}
              onChange={(event) => void setStartWithWindows(event.target.checked)}
            />
            <span aria-hidden="true" />
          </label>
        </div>
      </section>

      <section className="panel panel-wide">
        <div className="panel-copy">
          <h2>{t('general.hotkeyTitle')}</h2>
          <p>{t('general.hotkeyHint')}</p>
        </div>
        <div className="hotkey-recorder">
          <kbd>{acceleratorLabel(general.hotkey)}</kbd>
          <button
            type="button"
            onClick={() => setRecording((current) => !current)}
            disabled={pending !== null}
            aria-pressed={recording}
          >
            {recording ? t('general.hotkeyRecording') : t('general.hotkeyRecord')}
          </button>
        </div>
        {recording && <p className="field-hint">{t('general.hotkeyCancel')}</p>}
      </section>

      <section className="panel panel-wide appearance-panel">
        <div className="panel-copy">
          <h2>{t('general.appearanceTitle')}</h2>
          <p>{t('general.appearanceBody')}</p>
        </div>

        <div className="appearance-group">
          <div className="appearance-label">
            <strong>{t('general.settingsTheme')}</strong>
            <span>{t('general.settingsThemeHint')}</span>
          </div>
          <div
            className="segmented-control mode-switch"
            data-tone={general.theme === 'system' ? 'auto' : general.theme}
            role="radiogroup"
            aria-label={t('general.settingsTheme')}
          >
            {(
              [
                ['dark', t('general.themeDark')],
                ['light', t('general.themeLight')],
                ['system', t('general.themeSystem')]
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                aria-checked={general.theme === value}
                className={general.theme === value ? 'segment-active' : ''}
                key={value}
                disabled={pending !== null}
                onClick={() => void setTheme(value)}
              >
                <ThemeIcon mode={value} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="appearance-group">
          <div className="appearance-label">
            <strong>{t('general.widgetDefaultTheme')}</strong>
            <span>{t('general.widgetDefaultThemeHint')}</span>
          </div>
          <div
            className="segmented-control mode-switch"
            data-tone={
              general.widgetDefaultTheme === 'system' ? 'auto' : general.widgetDefaultTheme
            }
            role="radiogroup"
            aria-label={t('general.widgetDefaultTheme')}
          >
            {(
              [
                ['dark', t('general.themeDark')],
                ['light', t('general.themeLight')],
                ['system', t('general.themeSystem')]
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                role="radio"
                aria-checked={general.widgetDefaultTheme === value}
                className={general.widgetDefaultTheme === value ? 'segment-active' : ''}
                key={value}
                disabled={pending !== null}
                onClick={() => void setWidgetDefaultTheme(value)}
              >
                <ThemeIcon mode={value} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="appearance-group">
          <div className="appearance-label">
            <strong>{t('general.accentTitle')}</strong>
            <span>{t('general.accentBody')}</span>
          </div>
          <div className="accent-row" role="radiogroup" aria-label={t('general.accentTitle')}>
            {ACCENT_COLORS.map((accent) => (
              <button
                type="button"
                role="radio"
                aria-checked={general.accent === accent}
                className={
                  general.accent === accent ? 'accent-choice accent-active' : 'accent-choice'
                }
                data-accent={accent}
                key={accent}
                disabled={pending !== null}
                onClick={() => void setAccent(accent)}
              >
                <span className="accent-swatch" aria-hidden="true" />
                <span>{t(ACCENT_LABEL_KEYS[accent])}</span>
                {general.accent === accent && (
                  <span className="choice-check" aria-hidden="true">
                    <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
                      <path
                        d="M2.5 6.5 4.8 9 9.5 3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <CursorGallery
          key={JSON.stringify(general.cursor)}
          general={general}
          onGeneral={onGeneral}
          toast={toast}
        />
      </section>

      <section className="panel panel-wide">
        <div className="panel-copy">
          <h2>{t('general.maintenanceTitle')}</h2>
        </div>
        <div className="maintenance-grid">
          <div className="setting-row setting-row-compact">
            <div>
              <strong>{t('general.resetLayout')}</strong>
              <span>{t('general.resetLayoutHint')}</span>
            </div>
            <button
              type="button"
              className="button-danger"
              disabled={pending !== null}
              onClick={() => void resetLayout()}
            >
              {t('general.resetLayout')}
            </button>
          </div>
          <div className="setting-row setting-row-compact">
            <div>
              <strong>{t('general.openDataFolder')}</strong>
              <span>{t('general.openDataFolderHint')}</span>
            </div>
            <button type="button" disabled={pending !== null} onClick={() => void openDataFolder()}>
              {t('common.open')}
            </button>
          </div>
          <div className="setting-row setting-row-compact">
            <div>
              <strong>{t('general.diagnostics')}</strong>
              <span>{t('general.diagnosticsHint')}</span>
            </div>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void exportDiagnostics()}
            >
              {pending === 'diagnostics' ? t('general.exporting') : t('general.diagnostics')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
