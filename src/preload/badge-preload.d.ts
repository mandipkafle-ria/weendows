import type { BadgeApi } from '../shared/ipc'

declare global {
  interface Window {
    badgeApi: BadgeApi
  }
}

export {}
