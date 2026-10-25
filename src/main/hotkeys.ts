import { globalShortcut } from 'electron'
import { EDIT_MODE_HOTKEY } from '../shared/constants'

export interface HotkeyResult {
  ok: boolean
  error?: string
}

export function registerEditModeHotkey(onToggle: () => void): HotkeyResult {
  try {
    const ok = globalShortcut.register(EDIT_MODE_HOTKEY, onToggle)
    return ok ? { ok: true } : { ok: false, error: `${EDIT_MODE_HOTKEY} is already in use` }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
