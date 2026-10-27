import {
  EDIT_MODE_HOTKEY,
  SETTINGS_WINDOW_HEIGHT,
  SETTINGS_WINDOW_WIDTH
} from '../../shared/constants'
import { appSettingsSchema } from '../../shared/schemas'
import type { AccentColor, AppSettingsFile, CursorStyle, ThemeSource } from '../../shared/types'
import log from './logger'
import { JsonStore } from './store'

export const DEFAULT_APP_SETTINGS: AppSettingsFile = {
  schema: 1,
  theme: 'system',
  accent: 'ember',
  cursorStyle: 'system',
  cursorSystemWide: false,
  hotkey: EDIT_MODE_HOTKEY,
  window: {
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT
  },
  onboardingCompleted: false
}

export class AppSettingsService {
  private readonly store: JsonStore<AppSettingsFile>

  constructor(file: string) {
    this.store = new JsonStore<AppSettingsFile>({
      file,
      schema: appSettingsSchema,
      defaults: () => structuredClone(DEFAULT_APP_SETTINGS),
      debounceMs: 500,
      onCorrupt: (error, backupPath) => {
        log.warn('settings.json was unreadable; defaults were restored', {
          backupPath,
          error: error.message
        })
      },
      onWriteError: (error) => {
        log.error('Settings write failed', error.message)
      }
    })
  }

  async load(): Promise<void> {
    await this.store.load()
  }

  get(): AppSettingsFile {
    return structuredClone(this.store.get())
  }

  async setTheme(theme: ThemeSource): Promise<AppSettingsFile> {
    this.store.update((data) => {
      data.theme = theme
    })
    return this.get()
  }

  async setAccent(accent: AccentColor): Promise<AppSettingsFile> {
    this.store.update((data) => {
      data.accent = accent
    })
    return this.get()
  }

  async setCursorStyle(cursorStyle: CursorStyle): Promise<AppSettingsFile> {
    this.store.update((data) => {
      data.cursorStyle = cursorStyle
    })
    return this.get()
  }

  async setCursorSystemWide(enabled: boolean): Promise<AppSettingsFile> {
    this.store.update((data) => {
      data.cursorSystemWide = enabled
    })
    return this.get()
  }

  async setHotkey(hotkey: string): Promise<AppSettingsFile> {
    this.store.update((data) => {
      data.hotkey = hotkey
    })
    return this.get()
  }

  setWindowSize(width: number, height: number): void {
    const safeWidth = Math.max(720, Math.min(10000, Math.round(width)))
    const safeHeight = Math.max(520, Math.min(10000, Math.round(height)))
    const current = this.store.get().window
    if (current.width === safeWidth && current.height === safeHeight) {
      return
    }
    this.store.update((data) => {
      data.window.width = safeWidth
      data.window.height = safeHeight
    })
  }

  async completeOnboarding(): Promise<AppSettingsFile> {
    this.store.update((data) => {
      data.onboardingCompleted = true
    })
    await this.store.flush()
    return this.get()
  }

  async flush(): Promise<void> {
    await this.store.flush()
  }
}
