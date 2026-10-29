import { useMemo, useState, type JSX } from 'react'
import { cursorImage } from '../../shared/cursor'
import type {
  CursorClickAnimation,
  CursorConfig,
  CursorStyle,
  GeneralState
} from '../../shared/types'
import { CURSOR_CLICK_ANIMATIONS, CURSOR_STYLES, SYSTEM_CURSOR_STYLES } from '../../shared/types'
import { t } from '../i18n'
import ColorPicker from './ColorPicker'
import SliderField from './SliderField'
import type { ToastLevel } from './useToasts'

const CURSOR_LABEL_KEYS: Record<CursorStyle, string> = {
  system: 'general.cursorSystem',
  pixel: 'general.cursorPixel',
  crosshair: 'general.cursorCrosshair'
}

const ANIMATION_LABEL_KEYS: Record<CursorClickAnimation, string> = {
  ripple: 'cursor.animationRipple',
  burst: 'cursor.animationBurst',
  none: 'cursor.animationNone'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sameCursor(a: CursorConfig, b: CursorConfig): boolean {
  return (
    a.style === b.style &&
    a.color === b.color &&
    a.size === b.size &&
    a.opacity === b.opacity &&
    a.glowIntensity === b.glowIntensity &&
    a.clickAnimation === b.clickAnimation
  )
}

interface CursorGalleryProps {
  general: GeneralState
  onGeneral: (general: GeneralState) => void
  toast: (message: string, level?: ToastLevel) => void
}

export default function CursorGallery({
  general,
  onGeneral,
  toast
}: CursorGalleryProps): JSX.Element {
  const [draft, setDraft] = useState<CursorConfig>(general.cursor)
  const [systemWide, setSystemWide] = useState(general.cursor.systemWide)
  const [pending, setPending] = useState(false)
  const [pulse, setPulse] = useState(0)

  const activeStyle = draft.style
  const systemWideSupported =
    activeStyle !== 'system' && (SYSTEM_CURSOR_STYLES as readonly string[]).includes(activeStyle)
  const preview = useMemo(() => cursorImage(draft), [draft])
  const dirty = !sameCursor(draft, general.cursor) || systemWide !== general.cursor.systemWide

  const update = (patch: Partial<CursorConfig>): void => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  const chooseStyle = (style: CursorStyle): void => {
    update({ style })
    if (!(SYSTEM_CURSOR_STYLES as readonly string[]).includes(style) || style === 'system') {
      setSystemWide(false)
    }
  }

  const apply = async (): Promise<void> => {
    setPending(true)
    try {
      onGeneral(
        await window.api.setCursor({
          style: draft.style,
          color: draft.color,
          size: draft.size,
          opacity: draft.opacity,
          glowIntensity: draft.glowIntensity,
          clickAnimation: draft.clickAnimation,
          systemWide: systemWide && systemWideSupported
        })
      )
      toast(t('cursor.applied'), 'success')
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(false)
    }
  }

  const reset = (): void => {
    setDraft(general.cursor)
    setSystemWide(general.cursor.systemWide)
  }

  const cursorCss = preview
    ? `url("${preview.url}") ${preview.hotspotX} ${preview.hotspotY}, auto`
    : 'auto'

  return (
    <div className="cursor-gallery">
      <div
        className="cursor-gallery-styles"
        role="radiogroup"
        aria-label={t('general.cursorTitle')}
      >
        {CURSOR_STYLES.map((style) => {
          const image = cursorImage({ ...draft, style })
          return (
            <button
              type="button"
              role="radio"
              aria-checked={activeStyle === style}
              className={
                activeStyle === style ? 'cursor-style cursor-style-active' : 'cursor-style'
              }
              key={style}
              disabled={pending}
              onClick={() => chooseStyle(style)}
            >
              <span
                className="cursor-style-art"
                style={image ? { backgroundImage: `url("${image.url}")` } : undefined}
                aria-hidden="true"
              >
                {!image && <span className="cursor-style-system" />}
              </span>
              <span>{t(CURSOR_LABEL_KEYS[style])}</span>
            </button>
          )
        })}
      </div>

      <div
        className="cursor-stage"
        style={{ cursor: cursorCss }}
        onClick={() => setPulse((n) => n + 1)}
      >
        <div className="cursor-stage-card">
          <span className="cursor-stage-dot" />
          <span className="cursor-stage-line" />
          <span className="cursor-stage-line short" />
        </div>
        <div className="cursor-stage-card muted">
          <span className="cursor-stage-line" />
          <span className="cursor-stage-line short" />
        </div>
        {preview && (
          <img
            className="cursor-stage-image"
            src={preview.url}
            alt=""
            style={{ opacity: 0.55 + draft.opacity * 0.45 }}
            draggable={false}
          />
        )}
        <span className="cursor-stage-hint">{t('cursor.stageHint')}</span>
        {draft.clickAnimation !== 'none' && pulse > 0 && (
          <span
            key={pulse}
            className={`cursor-click-pulse pulse-${draft.clickAnimation}`}
            style={{ color: draft.color }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="cursor-controls">
        <ColorPicker
          label={t('cursor.color')}
          value={draft.color}
          disabled={pending || activeStyle === 'system'}
          onChange={(color) => update({ color })}
        />
        <SliderField
          label={t('cursor.size')}
          value={draft.size}
          min={8}
          max={24}
          suffix="px"
          disabled={pending || activeStyle === 'system'}
          onChange={(size) => update({ size })}
        />
        <SliderField
          label={t('cursor.opacity')}
          value={Math.round(draft.opacity * 100)}
          min={10}
          max={100}
          suffix="%"
          disabled={pending || activeStyle === 'system'}
          onChange={(opacity) => update({ opacity: opacity / 100 })}
        />
        <div className="cursor-animation">
          <span className="cursor-animation-label">{t('cursor.clickAnimation')}</span>
          <div
            className="segmented-control"
            role="radiogroup"
            aria-label={t('cursor.clickAnimation')}
          >
            {CURSOR_CLICK_ANIMATIONS.map((animation) => (
              <button
                type="button"
                role="radio"
                aria-checked={draft.clickAnimation === animation}
                className={draft.clickAnimation === animation ? 'segment-active' : ''}
                key={animation}
                disabled={pending || activeStyle === 'system'}
                onClick={() => update({ clickAnimation: animation })}
              >
                {t(ANIMATION_LABEL_KEYS[animation])}
              </button>
            ))}
          </div>
        </div>
      </div>

      {general.platform === 'win32' && (
        <div className="setting-row setting-row-compact cursor-scope-row">
          <div>
            <strong>{t('general.cursorSystemWide')}</strong>
            <span>
              {!systemWideSupported
                ? t('cursor.systemWideUnsupported')
                : t('general.cursorSystemWideHint')}
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={systemWide && systemWideSupported}
              disabled={!systemWideSupported || pending}
              onChange={(event) => setSystemWide(event.target.checked)}
            />
            <span aria-hidden="true" />
          </label>
        </div>
      )}

      <div className="cursor-actions">
        <button type="button" className="button-quiet" disabled={!dirty || pending} onClick={reset}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={!dirty || pending}
          onClick={() => void apply()}
        >
          {pending ? t('common.saving') : t('cursor.apply')}
        </button>
      </div>
    </div>
  )
}
