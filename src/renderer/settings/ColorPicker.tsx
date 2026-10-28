import { useId, useMemo, useState, type JSX } from 'react'
import { t } from '../i18n'

interface SwatchDef {
  hex: string
  name: string
  category: 'neutrals' | 'vibrant' | 'deep' | 'pastels'
}

const PALETTE: SwatchDef[] = [
  // Neutrals / Monochrome
  { hex: '#ffffff', name: 'Pure White', category: 'neutrals' },
  { hex: '#f8fafc', name: 'Ghost White', category: 'neutrals' },
  { hex: '#e2e8f0', name: 'Light Silver', category: 'neutrals' },
  { hex: '#cbd5e1', name: 'Zinc Gray', category: 'neutrals' },
  { hex: '#94a3b8', name: 'Slate Gray', category: 'neutrals' },
  { hex: '#64748b', name: 'Cool Steel', category: 'neutrals' },
  { hex: '#334155', name: 'Charcoal', category: 'neutrals' },
  { hex: '#1e293b', name: 'Dark Slate', category: 'neutrals' },
  { hex: '#0f172a', name: 'Obsidian', category: 'neutrals' },
  { hex: '#000000', name: 'Pure Black', category: 'neutrals' },

  // Vibrant / Primary / Neon
  { hex: '#ef4444', name: 'Ruby Red', category: 'vibrant' },
  { hex: '#f97316', name: 'Sunset Orange', category: 'vibrant' },
  { hex: '#ff7a45', name: 'HomeLayer Ember', category: 'vibrant' },
  { hex: '#f59e0b', name: 'Amber Gold', category: 'vibrant' },
  { hex: '#eab308', name: 'Cyber Yellow', category: 'vibrant' },
  { hex: '#84cc16', name: 'Neon Lime', category: 'vibrant' },
  { hex: '#10b981', name: 'Emerald Green', category: 'vibrant' },
  { hex: '#34d399', name: 'Mint Green', category: 'vibrant' },
  { hex: '#14b8a6', name: 'Teal', category: 'vibrant' },
  { hex: '#06b6d4', name: 'Electric Cyan', category: 'vibrant' },
  { hex: '#38e8d0', name: 'Aqua Glow', category: 'vibrant' },
  { hex: '#3b82f6', name: 'Sky Blue', category: 'vibrant' },
  { hex: '#6366f1', name: 'Indigo Dream', category: 'vibrant' },
  { hex: '#8b5cf6', name: 'Electric Violet', category: 'vibrant' },
  { hex: '#a78bfa', name: 'Lavender Purple', category: 'vibrant' },
  { hex: '#ec4899', name: 'Hot Pink', category: 'vibrant' },
  { hex: '#f43f5e', name: 'Neon Rose', category: 'vibrant' },

  // Deep & Midnight Desktop Tones
  { hex: '#0b132b', name: 'Deep Space', category: 'deep' },
  { hex: '#1a1a2e', name: 'Midnight Navy', category: 'deep' },
  { hex: '#16213e', name: 'Deep Sapphire', category: 'deep' },
  { hex: '#1f1a3a', name: 'Dark Velvet', category: 'deep' },
  { hex: '#2e1065', name: 'Dark Plum', category: 'deep' },
  { hex: '#4c0519', name: 'Deep Wine', category: 'deep' },
  { hex: '#450a0a', name: 'Dark Crimson', category: 'deep' },
  { hex: '#422006', name: 'Deep Espresso', category: 'deep' },
  { hex: '#064e3b', name: 'Deep Forest', category: 'deep' },
  { hex: '#134e4a', name: 'Midnight Teal', category: 'deep' },
  { hex: '#111318', name: 'Dark Onyx', category: 'deep' },

  // Soft Pastels & Tinted Glass
  { hex: '#fee2e2', name: 'Soft Blush', category: 'pastels' },
  { hex: '#ffedd5', name: 'Warm Cream', category: 'pastels' },
  { hex: '#fef3c7', name: 'Vanilla Ice', category: 'pastels' },
  { hex: '#ecfccb', name: 'Soft Lime', category: 'pastels' },
  { hex: '#d1fae5', name: 'Mint Frost', category: 'pastels' },
  { hex: '#cffafe', name: 'Ice Cyan', category: 'pastels' },
  { hex: '#e0e7ff', name: 'Periwinkle Mist', category: 'pastels' },
  { hex: '#f3e8ff', name: 'Lavender Mist', category: 'pastels' },
  { hex: '#fce7f3', name: 'Pastel Rose', category: 'pastels' },
  { hex: '#f4f1ea', name: 'Warm Paper', category: 'pastels' }
]

type PaletteFilter = 'all' | 'vibrant' | 'deep' | 'pastels' | 'neutrals'

interface ColorPickerProps {
  label?: string
  value: string
  disabled?: boolean
  allowClear?: boolean
  onChange: (value: string) => void
  onClear?: () => void
}

function normalizeHex(input: string): string | null {
  const trimmed = input.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const r = trimmed[1]
    const g = trimmed[2]
    const b = trimmed[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^[0-9a-f]{6}$/i.test(trimmed)) {
    return `#${trimmed}`.toLowerCase()
  }
  if (/^[0-9a-f]{3}$/i.test(trimmed)) {
    const r = trimmed[0]
    const g = trimmed[1]
    const b = trimmed[2]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return null
}

export default function ColorPicker({
  label,
  value,
  disabled = false,
  allowClear = false,
  onChange,
  onClear
}: ColorPickerProps): JSX.Element {
  const inputId = useId()
  const [filter, setFilter] = useState<PaletteFilter>('all')
  const [prevValue, setPrevValue] = useState(value)
  const [textInput, setTextInput] = useState(value)
  const [hasEyeDropper] = useState(() => typeof window !== 'undefined' && 'EyeDropper' in window)

  if (prevValue !== value) {
    setPrevValue(value)
    setTextInput(value)
  }

  const filteredSwatches = useMemo(() => {
    if (filter === 'all') {
      return PALETTE
    }
    return PALETTE.filter((entry) => entry.category === filter)
  }, [filter])

  const safeColor = normalizeHex(value) ?? '#ffffff'
  const isMatch = (hex: string): boolean => value.toLowerCase() === hex.toLowerCase()

  const handleHexChange = (inputVal: string): void => {
    setTextInput(inputVal)
    const valid = normalizeHex(inputVal)
    if (valid) {
      onChange(valid)
    }
  }

  const handleHexBlur = (): void => {
    const valid = normalizeHex(textInput)
    if (valid) {
      onChange(valid)
      setTextInput(valid.toUpperCase())
    } else {
      setTextInput(value.toUpperCase())
    }
  }

  const handleEyeDropper = async (): Promise<void> => {
    if (!hasEyeDropper || disabled) {
      return
    }
    try {
      // @ts-expect-error - EyeDropper API is standard in modern Chromium
      const eyeDropper = new window.EyeDropper()
      const result = await eyeDropper.open()
      if (result && typeof result.sRGBHex === 'string') {
        const hex = result.sRGBHex.toLowerCase()
        onChange(hex)
        setTextInput(hex.toUpperCase())
      }
    } catch {
      // User cancelled picker or unsupported
    }
  }

  return (
    <div className="color-picker" role="group" aria-label={label ?? 'Color picker'}>
      {label && (
        <div className="color-picker-header">
          <label htmlFor={inputId} className="color-picker-label">
            {label}
          </label>
          <span className="color-picker-badge" aria-hidden="true">
            {value.toUpperCase()}
          </span>
        </div>
      )}

      {/* Main Bar: Swatch Trigger + Hex Input + Color Wheel Trigger + EyeDropper + Clear */}
      <div className="color-picker-input-bar">
        <label
          className="color-picker-swatch-box"
          title={`Choose custom color (${value})`}
          tabIndex={-1}
        >
          <span className="color-checkerboard" aria-hidden="true" />
          <span
            className="color-swatch-fill"
            style={{ backgroundColor: value }}
            aria-hidden="true"
          />
          <input
            id={inputId}
            type="color"
            value={safeColor}
            disabled={disabled}
            aria-label={`${label ?? 'Color'}: ${value}`}
            onChange={(event) => {
              onChange(event.target.value)
              setTextInput(event.target.value.toUpperCase())
            }}
          />
        </label>

        <div className="color-hex-wrapper">
          <span className="color-hex-hash" aria-hidden="true">
            #
          </span>
          <input
            type="text"
            className="color-hex-field"
            value={textInput.replace(/^#/, '')}
            disabled={disabled}
            maxLength={6}
            placeholder="RRGGBB"
            spellCheck={false}
            autoComplete="off"
            aria-label="Hex color code"
            onChange={(event) => handleHexChange(event.target.value)}
            onBlur={handleHexBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleHexBlur()
              }
            }}
          />
        </div>

        {/* Custom Color Wheel Trigger */}
        <label
          className="button-quiet color-action-btn color-wheel-btn"
          title="Open system color wheel"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="color-icon">
            <path
              d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"
              fill="currentColor"
            />
            <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.6" />
          </svg>
          <span className="sr-only">Open color wheel</span>
          <input
            type="color"
            value={safeColor}
            disabled={disabled}
            onChange={(event) => {
              onChange(event.target.value)
              setTextInput(event.target.value.toUpperCase())
            }}
          />
        </label>

        {/* Eyedropper Tool */}
        {hasEyeDropper && (
          <button
            type="button"
            className="button-quiet color-action-btn eyedropper-btn"
            title="Pick color from screen"
            aria-label="Pick color from screen"
            disabled={disabled}
            onClick={() => void handleEyeDropper()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="color-icon">
              <path
                d="m19.35 10.04-6.39-6.39a2.5 2.5 0 0 0-3.54 0L6.44 6.63 8.56 8.75l2.12-2.12 3.54 3.54-5.66 5.66H7.12v-1.44l-2.12-2.12v3.56a2 2 0 0 0 .59 1.41l1.41 1.41a2 2 0 0 0 1.41.59h3.56l-2.12-2.12H10.5l6.36-6.36 2.49 2.49 2.12-2.12-2.12-2.16z"
                fill="currentColor"
              />
            </svg>
          </button>
        )}

        {/* Clear / Auto Button */}
        {allowClear && onClear && (
          <button
            type="button"
            className="button-quiet color-clear-btn"
            disabled={disabled}
            onClick={onClear}
            title={t('widgets.customize.themeAuto')}
          >
            {t('widgets.customize.themeAuto')}
          </button>
        )}
      </div>

      {/* Palette Category Selector */}
      <div className="color-palette-filter" role="tablist" aria-label="Color palette categories">
        {(
          [
            ['all', 'All'],
            ['vibrant', 'Vibrant'],
            ['deep', 'Deep'],
            ['pastels', 'Pastel'],
            ['neutrals', 'Grays']
          ] as const
        ).map(([key, title]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? 'palette-tab palette-tab-active' : 'palette-tab'}
            disabled={disabled}
            onClick={() => setFilter(key)}
          >
            {title}
          </button>
        ))}
      </div>

      {/* Swatches Grid */}
      <div className="color-swatches-grid" role="group" aria-label="Color swatches">
        {filteredSwatches.map((swatch) => {
          const active = isMatch(swatch.hex)
          return (
            <button
              type="button"
              key={swatch.hex}
              className={active ? 'color-swatch color-swatch-active' : 'color-swatch'}
              style={{ backgroundColor: swatch.hex }}
              disabled={disabled}
              title={`${swatch.name} (${swatch.hex.toUpperCase()})`}
              aria-label={`${swatch.name} ${swatch.hex.toUpperCase()}`}
              aria-pressed={active}
              onClick={() => {
                onChange(swatch.hex)
                setTextInput(swatch.hex.toUpperCase())
              }}
            >
              <span className="sr-only">
                {swatch.name} {swatch.hex}
              </span>
              {active && <span className="swatch-check-dot" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
