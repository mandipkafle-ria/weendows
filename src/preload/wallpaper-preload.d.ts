import type { WallpaperHostApi } from '../shared/ipc'

declare global {
  interface Window {
    wallpaperApi: WallpaperHostApi
  }
}

export {}
