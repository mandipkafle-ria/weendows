import { describe, expect, it } from 'vitest'
import { acceleratorFromKeyEvent, acceleratorLabel } from '../../src/shared/hotkeys'

describe('acceleratorFromKeyEvent', () => {
  it('builds a Ctrl+Alt shortcut from a keyboard event', () => {
    expect(
      acceleratorFromKeyEvent({
        key: 'e',
        code: 'KeyE',
        ctrlKey: true,
        altKey: true
      })
    ).toBe('Control+Alt+E')
  })

  it('supports function keys without a command modifier', () => {
    expect(acceleratorFromKeyEvent({ key: 'F8', code: 'F8' })).toBe('F8')
  })

  it('keeps shift and meta modifiers in a stable order', () => {
    expect(
      acceleratorFromKeyEvent({
        key: 'k',
        code: 'KeyK',
        metaKey: true,
        shiftKey: true,
        ctrlKey: true
      })
    ).toBe('Control+Shift+Super+K')
  })

  it('rejects bare letters, modifier-only presses, and Escape', () => {
    expect(acceleratorFromKeyEvent({ key: 'a', code: 'KeyA' })).toBeNull()
    expect(
      acceleratorFromKeyEvent({ key: 'Control', code: 'ControlLeft', ctrlKey: true })
    ).toBeNull()
    expect(acceleratorFromKeyEvent({ key: 'Escape', code: 'Escape', altKey: true })).toBeNull()
  })

  it('normalizes named navigation keys', () => {
    expect(acceleratorFromKeyEvent({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true })).toBe(
      'Control+Up'
    )
  })
})

describe('acceleratorLabel', () => {
  it('uses Windows-friendly modifier names', () => {
    expect(acceleratorLabel('Control+Alt+E')).toBe('Ctrl + Alt + E')
    expect(acceleratorLabel('Super+Shift+F9')).toBe('Win + Shift + F9')
  })
})
