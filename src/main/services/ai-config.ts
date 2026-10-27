import { aiSettingsSchema } from '../../shared/schemas'
import type { AiSettings } from '../../shared/types'
import log from './logger'
import { JsonStore } from './store'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  model: '',
  width: 240,
  height: 240
}

export class AiConfigService {
  private readonly store: JsonStore<AiSettings>

  constructor(file: string) {
    this.store = new JsonStore<AiSettings>({
      file,
      schema: aiSettingsSchema,
      defaults: () => ({ ...DEFAULT_AI_SETTINGS }),
      debounceMs: 0,
      onCorrupt: (error, backupPath) => {
        log.warn('ai-settings.json was unreadable; defaults were restored', {
          backupPath,
          error: error.message
        })
      },
      onWriteError: (error) => {
        log.error('AI settings write failed', error.message)
      }
    })
  }

  async load(): Promise<void> {
    await this.store.load()
  }

  get(): AiSettings {
    return { ...this.store.get() }
  }

  async save(patch: Partial<AiSettings>): Promise<AiSettings> {
    this.store.update((data) => {
      Object.assign(data, patch)
    })
    await this.store.flush()
    return this.get()
  }
}
