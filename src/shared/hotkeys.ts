export interface KeyEventLike {
  key: string
  code?: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
}

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta'])

function mainKey(event: KeyEventLike): string | null {
  const code = event.code ?? ''
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter?.[1]) {
    return letter[1]
  }
  const digit = /^Digit([0-9])$/.exec(code)
  if (digit?.[1]) {
    return digit[1]
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return code
  }
  if (code === 'Space') {
    return 'Space'
  }

  const key = event.key
  if (key === ' ' || key === 'Spacebar') {
    return 'Space'
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) {
    return key
  }
  if (/^[a-zA-Z0-9]$/.test(key)) {
    return key.toUpperCase()
  }
  const named = new Set([
    'Backspace',
    'Delete',
    'Enter',
    'Escape',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Insert',
    'Tab',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Up',
    'Down',
    'Left',
    'Right',
    'Space'
  ])
  if (named.has(key)) {
    return key.startsWith('Arrow') ? key.slice(5) : key
  }
  return null
}

export function acceleratorFromKeyEvent(event: KeyEventLike): string | null {
  if (MODIFIER_KEYS.has(event.key) || event.key === 'Escape') {
    return null
  }

  const key = mainKey(event)
  if (!key) {
    return null
  }

  const tokens: string[] = []
  if (event.ctrlKey) {
    tokens.push('Control')
  }
  if (event.altKey) {
    tokens.push('Alt')
  }
  if (event.shiftKey) {
    tokens.push('Shift')
  }
  if (event.metaKey) {
    tokens.push('Super')
  }

  const hasCommandModifier = event.ctrlKey || event.altKey || event.metaKey
  if (!hasCommandModifier && !/^F\d+$/.test(key)) {
    return null
  }

  tokens.push(key)
  return tokens.join('+')
}

export function acceleratorLabel(accelerator: string): string {
  return accelerator
    .split('+')
    .map((token) => {
      if (token === 'Control') {
        return 'Ctrl'
      }
      if (token === 'Super') {
        return 'Win'
      }
      return token
    })
    .join(' + ')
}
