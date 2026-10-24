import type { SettingsApi } from '../shared/ipc'

declare global {
  interface Window {
    api: SettingsApi
  }
}

export {}
