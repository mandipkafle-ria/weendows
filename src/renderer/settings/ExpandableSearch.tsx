import { useEffect, useRef, useState, type JSX } from 'react'

interface ExpandableSearchProps {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  clearLabel: string
  className?: string
}

function SearchIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

export default function ExpandableSearch({
  value,
  onChange,
  label,
  placeholder,
  clearLabel,
  className
}: ExpandableSearchProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const expanded = open || Boolean(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus()
    }
  }, [expanded])

  const collapseIfEmpty = (): void => {
    if (!value) {
      setOpen(false)
    }
  }

  return (
    <div
      className={['expandable-search', expanded ? 'expandable-search-open' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="expandable-search-toggle"
        aria-label={label}
        aria-expanded={expanded}
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        <SearchIcon />
      </button>
      {expanded && (
        <input
          ref={inputRef}
          type="search"
          value={value}
          aria-label={label}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onBlur={collapseIfEmpty}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onChange('')
              setOpen(false)
            }
          }}
        />
      )}
      {expanded && value && (
        <button
          type="button"
          className="expandable-search-clear"
          aria-label={clearLabel}
          onClick={() => {
            onChange('')
            setOpen(false)
          }}
        >
          &#10005;
        </button>
      )}
    </div>
  )
}
