import { useState, type JSX } from 'react'
import type { BuiltinWidget, GeneralState, WidgetSummary } from '../../shared/types'
import { t } from '../i18n'
import type { ToastLevel } from './useToasts'

const FIRST_WIDGETS = [
  { type: 'clock', title: 'onboarding.clock', body: 'onboarding.clockBody' },
  { type: 'system', title: 'onboarding.system', body: 'onboarding.systemBody' },
  { type: 'app-grid', title: 'onboarding.appGrid', body: 'onboarding.appGridBody' }
] as const

interface OnboardingProps {
  builtins: BuiltinWidget[]
  widgets: WidgetSummary[]
  onComplete: (general: GeneralState) => void
  toast: (message: string, level?: ToastLevel) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function Onboarding({
  builtins,
  widgets,
  onComplete,
  toast
}: OnboardingProps): JSX.Element {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(FIRST_WIDGETS.map((widget) => widget.type))
  )
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  const available = FIRST_WIDGETS.filter((widget) =>
    builtins.some((builtin) => builtin.type === widget.type)
  )

  const finish = async (skip: boolean): Promise<void> => {
    setSaving(true)
    try {
      if (!skip && apiKey.trim()) {
        try {
          await window.api.saveAiKey('gemini', apiKey.trim())
          toast(t('onboarding.keySaved'), 'success')
        } catch (error) {
          toast(errorMessage(error), 'error')
        }
      }

      if (!skip) {
        for (const widget of available) {
          if (!selected.has(widget.type)) {
            continue
          }
          const exists = widgets.some((entry) => entry.manifest.builtinType === widget.type)
          if (!exists) {
            try {
              await window.api.addWidget(widget.type)
            } catch (error) {
              toast(errorMessage(error), 'error')
            }
          }
        }
      }

      const general = await window.api.completeOnboarding()
      onComplete(general)
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (type: string): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  return (
    <main className="onboarding">
      <div className="onboarding-shell">
        <header className="onboarding-head">
          <div className="brand">
            <span className="brand-dots" aria-hidden="true" />
            <div>
              <h1>{t('app.name')}</h1>
              <p>{t('onboarding.eyebrow')}</p>
            </div>
          </div>
          <span>{t('onboarding.step', { current: step + 1, total: 3 })}</span>
        </header>

        <div className="onboarding-progress" aria-hidden="true">
          <span className={step >= 0 ? 'progress-on' : ''} />
          <span className={step >= 1 ? 'progress-on' : ''} />
          <span className={step >= 2 ? 'progress-on' : ''} />
        </div>

        <section className="onboarding-body">
          {step === 0 && (
            <>
              <span className="eyebrow">{t('onboarding.eyebrow')}</span>
              <h2>{t('onboarding.welcomeTitle')}</h2>
              <p>{t('onboarding.welcomeBody')}</p>
              <div className="onboarding-privacy">
                <strong>{t('onboarding.privacyTitle')}</strong>
                <p>{t('onboarding.privacyBody')}</p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2>{t('onboarding.widgetsTitle')}</h2>
              <p>{t('onboarding.widgetsBody')}</p>
              <div className="onboarding-widgets">
                {available.map((widget) => (
                  <label className="onboarding-widget" key={widget.type}>
                    <input
                      type="checkbox"
                      checked={selected.has(widget.type)}
                      onChange={() => toggle(widget.type)}
                    />
                    <span>
                      <strong>{t(widget.title)}</strong>
                      <small>{t(widget.body)}</small>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>{t('onboarding.aiTitle')}</h2>
              <p>{t('onboarding.aiBody')}</p>
              <label className="field">
                <span>{t('onboarding.aiKeyLabel')}</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  placeholder={t('onboarding.aiKeyPlaceholder')}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </label>
            </>
          )}
        </section>

        <footer className="onboarding-actions">
          <button
            type="button"
            className="button-ghost"
            onClick={() => void finish(true)}
            disabled={saving}
          >
            {t('onboarding.skip')}
          </button>
          <div>
            {step > 0 && (
              <button
                type="button"
                className="button-secondary"
                onClick={() => setStep((current) => current - 1)}
                disabled={saving}
              >
                {t('common.back')}
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep((current) => current + 1)}
                disabled={saving}
              >
                {t('common.next')}
              </button>
            ) : (
              <button type="button" onClick={() => void finish(false)} disabled={saving}>
                {saving ? t('onboarding.saving') : t('onboarding.finish')}
              </button>
            )}
          </div>
        </footer>
      </div>
    </main>
  )
}
