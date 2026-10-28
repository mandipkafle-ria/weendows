import { randomUUID } from 'node:crypto'
import type { WidgetAppearance } from '../../shared/types'

export interface PreviewAppearance {
  appearance: WidgetAppearance
  theme: 'dark' | 'light'
  assetWidgetId?: string
}

const LIMIT = 200

export class WidgetPreviewAppearanceService {
  private readonly previews = new Map<string, PreviewAppearance>()

  create(appearance: WidgetAppearance, theme: 'dark' | 'light', assetWidgetId?: string): string {
    const token = randomUUID()
    this.previews.set(token, { appearance, theme, assetWidgetId })
    while (this.previews.size > LIMIT) {
      const oldest = this.previews.keys().next().value
      if (!oldest) {
        break
      }
      this.previews.delete(oldest)
    }
    return token
  }

  get(token: string): PreviewAppearance | null {
    return this.previews.get(token) ?? null
  }

  release(token: string): void {
    this.previews.delete(token)
  }
}
