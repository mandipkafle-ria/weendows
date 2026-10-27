import type { BundlePopoverApi } from '../shared/ipc'

declare global {
  interface Window {
    bundleApi: BundlePopoverApi
  }
}

export {}
