import { useEffect, useMemo, useState, type JSX } from 'react'
import { resolveWidgetAppearance } from '../../shared/appearance'
import { findBuiltinVariant } from '../../shared/builtins'
import type {
  BuiltinWidget,
  GeneralState,
  WidgetAppearance,
  WidgetBgImageFit,
  WidgetBgStyle,
  WidgetSummary,
  WidgetVariant
} from '../../shared/types'
import { t } from '../i18n'
import ColorPicker from './ColorPicker'
import SliderField from './SliderField'
import type { ThemeEnvId } from './themeEnvironments'
import type { ToastLevel } from './useToasts'
import WidgetPreview from './WidgetPreview'

interface WidgetCustomizeSheetProps {
  builtin: BuiltinWidget
  defaultVariant: string
  general: GeneralState
  themeEnv: ThemeEnvId
  themeMode?: 'dark' | 'light'
  themeLabel: string
  existing?: WidgetSummary | null
  onClose: () => void
  onSaved: () => Promise<void>
  toast: (message: string, level?: ToastLevel) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function variantName(variantId: string): string {
  const key = `widgets.variantNames.${variantId}`
  const value = t(key)
  return value === key ? variantId : value
}

function catalogName(type: string, fallback: string): string {
  const key = `widgets.catalog.${type}.name`
  const value = t(key)
  return value === key ? fallback : value
}

// A small abstract mark for each design, so the picker reads as a visual set
// instead of a row of identical pills. Variant tags carry the intent ("neon",
// "analog", "minimal"...), so the mark follows the design language.
function variantMotif(variant: WidgetVariant): JSX.Element {
  const key = [variant.id, ...(variant.tags ?? [])].join(' ')
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }

  if (/analog|ring|dial|orbit/i.test(key)) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7.5V12l2.6 2.2" />
      </svg>
    )
  }
  if (/neon|glow|cyber|aurora|electric|pulse/i.test(key)) {
    return (
      <svg {...common}>
        <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
      </svg>
    )
  }
  if (/terminal|mono|pixel|retro|matrix|type|dot/i.test(key)) {
    return (
      <svg {...common}>
        <rect x="3" y="4.5" width="18" height="15" rx="2.6" />
        <path d="M7.5 10 10 12.5l-2.5 2.5M12.6 15h4" />
      </svg>
    )
  }
  if (/minimal|clean|bare|slim|serene/i.test(key)) {
    return (
      <svg {...common}>
        <path d="M4 9h16M4 15h9" />
      </svg>
    )
  }
  if (/glass|frost|blur|crystal/i.test(key)) {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <path d="M8.5 15.5 15.5 8.5" opacity="0.6" />
      </svg>
    )
  }
  if (/calendar|grid|month|week|apps|folder|tile/i.test(key)) {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M8 10h8M8 14h5" />
    </svg>
  )
}

export default function WidgetCustomizeSheet({
  builtin,
  defaultVariant,
  general,
  themeEnv,
  themeMode,
  themeLabel,
  existing,
  onClose,
  onSaved,
  toast
}: WidgetCustomizeSheetProps): JSX.Element {
  const savedAppearance = useMemo(() => {
    const base = resolveWidgetAppearance(existing?.placement ?? null)
    if (!existing && themeMode) {
      return { ...base, themeOverride: themeMode }
    }
    return base
  }, [existing, themeMode])
  const [variant, setVariant] = useState(existing?.manifest.variant ?? defaultVariant)
  const [appearance, setAppearance] = useState<WidgetAppearance>(savedAppearance)
  const [widgetOpacity, setWidgetOpacity] = useState(existing?.placement.opacity ?? 1)
  const [pending, setPending] = useState(false)
  const [loadingImage, setLoadingImage] = useState(Boolean(existing?.placement.bgImage))

  useEffect(() => {
    if (!existing?.placement.bgImage) {
      return
    }
    let cancelled = false
    void window.api
      .getWidgetBackground(existing.placement.widgetId)
      .then((dataUrl) => {
        if (!cancelled && dataUrl) {
          setAppearance((current) => ({ ...current, bgImage: dataUrl }))
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoadingImage(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [existing])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const selectedVariant = findBuiltinVariant(builtin, variant)
  const effectiveTheme = appearance.themeOverride ?? themeMode ?? general.resolvedWidgetTheme
  const update = (patch: Partial<WidgetAppearance>): void => {
    setAppearance((current) => ({ ...current, ...patch }))
  }

  const pickImage = async (): Promise<void> => {
    setLoadingImage(true)
    try {
      const picked = await window.api.pickWidgetBackground()
      if (picked) {
        update({ bgImage: picked.dataUrl, bgStyle: 'solid' })
      }
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setLoadingImage(false)
    }
  }

  const save = async (): Promise<void> => {
    setPending(true)
    try {
      if (existing) {
        await window.api.setWidgetAppearance(existing.placement.widgetId, appearance)
        await window.api.setWidgetOpacity(existing.placement.widgetId, widgetOpacity)
        if (existing.manifest.variant !== variant) {
          await window.api.setWidgetVariant(existing.placement.widgetId, variant)
        }
        toast(t('widgets.customize.saved', { name: existing.manifest.name }), 'success')
      } else {
        await window.api.addWidget(builtin.type, variant, {
          ...appearance,
          cornerRadius: appearance.cornerRadius
        })
        toast(
          t('widgets.customize.added', {
            name: catalogName(builtin.type, builtin.name),
            design: variantName(variant)
          }),
          'success'
        )
      }
      await onSaved()
      onClose()
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(false)
    }
  }

  const title = existing
    ? existing.manifest.name
    : `${variantName(variant)} ${catalogName(builtin.type, builtin.name)}`

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="customize-sheet"
        data-theme-env={themeEnv}
        role="dialog"
        aria-modal="true"
        aria-label={t('widgets.customize.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="customize-head">
          <div>
            <span className="customize-eyebrow">
              {existing ? t('widgets.customize.edit') : t('widgets.customize.add')}
              <span className="customize-eyebrow-sep" aria-hidden="true">
                /
              </span>
              {themeLabel}
            </span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="sheet-close"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            &#10005;
          </button>
        </header>

        <div className="customize-body">
          <div className="customize-preview-pane">
            <div className="customize-preview-meta">
              <span className="customize-preview-tag">{variantName(selectedVariant.id)}</span>
              <span className="customize-preview-dim">
                {selectedVariant.width} &times; {selectedVariant.height}
              </span>
            </div>
            <div className="customize-preview-stage">
              <WidgetPreview
                source={{
                  kind: 'builtin',
                  type: builtin.type,
                  variant: selectedVariant.id
                }}
                width={selectedVariant.width}
                height={selectedVariant.height}
                dark={effectiveTheme === 'dark'}
                env={themeEnv}
                appearance={appearance}
                assetWidgetId={existing?.placement.widgetId}
                cursorStyle={general.cursor.style}
                title={title}
                interactive
                className="customize-preview"
              />
            </div>
            <div className="customize-preview-footer">
              <span className="customize-live-indicator" aria-hidden="true" />
              <span className="customize-preview-note">{t('widgets.customize.liveNote')}</span>
            </div>
          </div>

          <div className="customize-controls">
            <section className="customize-section">
              <h3>{t('widgets.customize.design')}</h3>
              <div className="design-grid" role="radiogroup" aria-label={t('widgets.design')}>
                {builtin.variants.map((entry) => {
                  const selected = variant === entry.id
                  return (
                    <button
                      type="button"
                      key={entry.id}
                      role="radio"
                      aria-checked={selected}
                      title={`${entry.width} × ${entry.height}`}
                      className={selected ? 'design-card design-card-active' : 'design-card'}
                      onClick={() => setVariant(entry.id)}
                    >
                      <span className="design-card-motif" aria-hidden="true">
                        {variantMotif(entry)}
                      </span>
                      <span className="design-card-text">
                        <span className="design-card-name">{variantName(entry.id)}</span>
                        <span className="design-card-size">
                          {entry.width} × {entry.height}
                        </span>
                      </span>
                      <span className="design-card-check" aria-hidden="true">
                        <svg viewBox="0 0 12 12" width="10" height="10">
                          <path
                            d="M2.4 6.2 4.7 8.5 9.6 3.6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="customize-section">
              <h3>{t('widgets.customize.theme')}</h3>
              <div
                className="segmented-control mode-switch"
                data-tone={appearance.themeOverride ?? 'auto'}
                role="radiogroup"
                aria-label={t('widgets.customize.theme')}
              >
                {(
                  [
                    [null, t('widgets.customize.themeAuto'), 'auto'],
                    ['dark', t('general.themeDark'), 'dark'],
                    ['light', t('general.themeLight'), 'light']
                  ] as const
                ).map(([value, label, mode]) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={appearance.themeOverride === value}
                    className={appearance.themeOverride === value ? 'segment-active' : ''}
                    key={value ?? 'auto'}
                    onClick={() => update({ themeOverride: value })}
                  >
                    {mode === 'auto' && (
                      <svg
                        className="segment-icon"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
                      </svg>
                    )}
                    {mode === 'dark' && (
                      <svg
                        className="segment-icon"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    )}
                    {mode === 'light' && (
                      <svg
                        className="segment-icon"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                      </svg>
                    )}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="customize-section">
              <h3>{t('widgets.customize.background')}</h3>
              <div
                className="segmented-control"
                role="radiogroup"
                aria-label={t('widgets.customize.background')}
              >
                {(
                  [
                    ['solid', t('widgets.customize.bg_solid'), 'solid'],
                    ['blur', t('widgets.customize.bg_blur'), 'blur'],
                    ['transparent', t('widgets.customize.bg_transparent'), 'transparent']
                  ] as const
                ).map(([style, label, bgKind]) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={appearance.bgStyle === style}
                    className={appearance.bgStyle === style ? 'segment-active' : ''}
                    key={style}
                    onClick={() => update({ bgStyle: style as WidgetBgStyle })}
                  >
                    {bgKind === 'solid' && (
                      <svg
                        className="segment-icon"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="4" />
                      </svg>
                    )}
                    {bgKind === 'blur' && (
                      <svg
                        className="segment-icon"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path
                          d="M12 3a9 9 0 0 0 0 18v-18z"
                          fill="currentColor"
                          fillOpacity="0.45"
                        />
                      </svg>
                    )}
                    {bgKind === 'transparent' && (
                      <svg
                        className="segment-icon"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="4" />
                        <line x1="3" y1="21" x2="21" y2="3" />
                      </svg>
                    )}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <ColorPicker
                label={t('widgets.customize.color')}
                value={appearance.bgColor ?? '#1a1a2e'}
                allowClear
                disabled={appearance.bgStyle === 'transparent'}
                onChange={(bgColor) => update({ bgColor })}
                onClear={() => update({ bgColor: null })}
              />
              <SliderField
                label={t('widgets.customize.opacity')}
                value={Math.round(appearance.bgOpacity * 100)}
                min={0}
                max={100}
                suffix="%"
                disabled={appearance.bgStyle === 'transparent'}
                onChange={(value) => update({ bgOpacity: value / 100 })}
              />
              <SliderField
                label={t('widgets.customize.blur')}
                value={appearance.bgBlur}
                min={0}
                max={20}
                suffix="px"
                disabled={appearance.bgStyle !== 'blur'}
                onChange={(bgBlur) => update({ bgBlur, bgStyle: 'blur' })}
              />
            </section>

            <section className="customize-section">
              <h3>{t('widgets.customize.image')}</h3>
              <div className="customize-image-row">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={loadingImage}
                  onClick={() => void pickImage()}
                >
                  {loadingImage ? t('common.loading') : t('widgets.customize.addImage')}
                </button>
                <button
                  type="button"
                  className="button-quiet"
                  disabled={!appearance.bgImage}
                  onClick={() => update({ bgImage: null })}
                >
                  {t('widgets.customize.clearImage')}
                </button>
              </div>
              <div
                className="segmented-control"
                role="radiogroup"
                aria-label={t('widgets.customize.fit')}
              >
                {(['cover', 'contain', 'tile'] as WidgetBgImageFit[]).map((fit) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={appearance.bgImageFit === fit}
                    className={appearance.bgImageFit === fit ? 'segment-active' : ''}
                    key={fit}
                    disabled={!appearance.bgImage || appearance.bgStyle === 'transparent'}
                    onClick={() => update({ bgImageFit: fit })}
                  >
                    {t(`widgets.customize.fit_${fit}`)}
                  </button>
                ))}
              </div>
            </section>

            <section className="customize-section">
              <h3>{t('widgets.customize.shape')}</h3>
              <SliderField
                label={t('widgets.customize.corners')}
                value={appearance.cornerRadius}
                min={0}
                max={64}
                suffix="px"
                onChange={(cornerRadius) => update({ cornerRadius })}
              />
              <SliderField
                label={t('widgets.customize.borderWidth')}
                value={appearance.borderWidth}
                min={0}
                max={8}
                suffix="px"
                onChange={(borderWidth) => update({ borderWidth })}
              />
              <SliderField
                label={t('widgets.customize.border')}
                value={Math.round(appearance.borderOpacity * 100)}
                min={0}
                max={100}
                suffix="%"
                onChange={(value) => update({ borderOpacity: value / 100 })}
              />
              <ColorPicker
                label={t('widgets.customize.borderColor')}
                value={appearance.borderColor ?? '#ffffff'}
                allowClear
                onChange={(borderColor) => update({ borderColor })}
                onClear={() => update({ borderColor: null })}
              />
              <SliderField
                label={t('widgets.customize.contentOpacity')}
                value={Math.round(appearance.contentOpacity * 100)}
                min={0}
                max={100}
                suffix="%"
                onChange={(value) => update({ contentOpacity: value / 100 })}
              />
            </section>

            {existing && (
              <section className="customize-section">
                <h3>{t('widgets.customize.window')}</h3>
                <SliderField
                  label={t('widgets.opacity')}
                  value={Math.round(widgetOpacity * 100)}
                  min={20}
                  max={100}
                  suffix="%"
                  onChange={(value) => setWidgetOpacity(value / 100)}
                />
              </section>
            )}
          </div>
        </div>

        <footer className="customize-foot">
          <button type="button" className="button-quiet" disabled={pending} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={pending || loadingImage}
            onClick={() => void save()}
          >
            {pending
              ? t('common.saving')
              : existing
                ? t('widgets.customize.save')
                : t('widgets.addToDesktop')}
          </button>
        </footer>
      </aside>
    </div>
  )
}
