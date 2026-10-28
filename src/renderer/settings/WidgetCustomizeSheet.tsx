import { useEffect, useMemo, useState, type JSX } from 'react'
import { resolveWidgetAppearance } from '../../shared/appearance'
import { findBuiltinVariant } from '../../shared/builtins'
import type {
  BuiltinWidget,
  GeneralState,
  WidgetAppearance,
  WidgetBgImageFit,
  WidgetBgStyle,
  WidgetSummary
} from '../../shared/types'
import { t } from '../i18n'
import ColorPicker from './ColorPicker'
import SliderField from './SliderField'
import type { ToastLevel } from './useToasts'
import WidgetPreview from './WidgetPreview'

interface WidgetCustomizeSheetProps {
  builtin: BuiltinWidget
  defaultVariant: string
  general: GeneralState
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

export default function WidgetCustomizeSheet({
  builtin,
  defaultVariant,
  general,
  existing,
  onClose,
  onSaved,
  toast
}: WidgetCustomizeSheetProps): JSX.Element {
  const savedAppearance = useMemo(
    () => resolveWidgetAppearance(existing?.placement ?? null),
    [existing]
  )
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
  const effectiveTheme = appearance.themeOverride ?? general.resolvedWidgetTheme
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
        role="dialog"
        aria-modal="true"
        aria-label={t('widgets.customize.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="customize-head">
          <div>
            <span className="customize-eyebrow">
              {existing ? t('widgets.customize.edit') : t('widgets.customize.add')}
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
              <div className="variant-row" role="radiogroup" aria-label={t('widgets.design')}>
                {builtin.variants.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    role="radio"
                    aria-checked={variant === entry.id}
                    className={
                      variant === entry.id ? 'variant-pill variant-active' : 'variant-pill'
                    }
                    onClick={() => setVariant(entry.id)}
                  >
                    {variantName(entry.id)}
                  </button>
                ))}
              </div>
            </section>

            <section className="customize-section">
              <h3>{t('widgets.customize.theme')}</h3>
              <div
                className="segmented-control"
                role="radiogroup"
                aria-label={t('widgets.customize.theme')}
              >
                {(
                  [
                    [null, t('widgets.customize.themeAuto')],
                    ['dark', t('general.themeDark')],
                    ['light', t('general.themeLight')]
                  ] as const
                ).map(([value, label]) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={appearance.themeOverride === value}
                    className={appearance.themeOverride === value ? 'segment-active' : ''}
                    key={value ?? 'auto'}
                    onClick={() => update({ themeOverride: value })}
                  >
                    {label}
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
                {(['solid', 'blur', 'transparent'] as WidgetBgStyle[]).map((style) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={appearance.bgStyle === style}
                    className={appearance.bgStyle === style ? 'segment-active' : ''}
                    key={style}
                    onClick={() => update({ bgStyle: style })}
                  >
                    {t(`widgets.customize.bg_${style}`)}
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
