import type { CSSProperties, JSX } from 'react'

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
}

export default function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  disabled = false,
  onChange
}: SliderFieldProps): JSX.Element {
  const percent = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2)

  return (
    <label className={disabled ? 'slider-field is-disabled' : 'slider-field'}>
      <span className="slider-field-label">
        <span>{label}</span>
        <output className="slider-value-badge">
          {text}
          {suffix}
        </output>
      </span>
      <div
        className="slider-track-wrap"
        style={
          {
            '--slider-pct': `${percent}%`,
            '--slider-ratio': percent / 100
          } as CSSProperties
        }
      >
        {/* Soft accent halo that follows the thumb while dragging. */}
        <span className="slider-glow" aria-hidden="true" />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </label>
  )
}
