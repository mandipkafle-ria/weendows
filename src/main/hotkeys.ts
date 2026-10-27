import { globalShortcut } from 'electron'
import log from './services/logger'

export interface HotkeyResult {
  ok: boolean
  error?: string
}

export class HotkeyService {
  private current: string | null = null

  constructor(private readonly onToggle: () => void) {}

  register(accelerator: string): HotkeyResult {
    if (this.current === accelerator && globalShortcut.isRegistered(accelerator)) {
      return { ok: true }
    }

    const previous = this.current
    if (previous && globalShortcut.isRegistered(previous)) {
      globalShortcut.unregister(previous)
    }

    try {
      const registered = globalShortcut.register(accelerator, this.onToggle)
      if (!registered) {
        this.restore(previous)
        return { ok: false, error: `${accelerator} is already in use` }
      }
      this.current = accelerator
      log.info(`Registered global shortcut ${accelerator}`)
      return { ok: true }
    } catch (error) {
      this.restore(previous)
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  currentAccelerator(): string | null {
    return this.current
  }

  stop(): void {
    globalShortcut.unregisterAll()
    this.current = null
  }

  private restore(previous: string | null): void {
    if (!previous) {
      return
    }
    try {
      if (globalShortcut.register(previous, this.onToggle)) {
        this.current = previous
      }
    } catch (error) {
      log.warn('Could not restore the previous global shortcut', error)
    }
  }
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
