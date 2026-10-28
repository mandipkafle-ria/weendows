import type { JSX } from 'react'

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
  return (
    <label className="slider-field">
      <span className="slider-field-label">
        <span>{label}</span>
        <output>
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
