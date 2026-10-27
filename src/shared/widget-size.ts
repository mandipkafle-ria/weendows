import { AI_MIN_SIZE_RATIO } from './constants'
import type { WidgetManifest } from './types'

export interface WidgetSizeLimits {
  minWidth: number
  minHeight: number
}

interface SizeRequest {
  minWidth?: number
  minHeight?: number
}

export function minimumSizeFor(
  width: number,
  height: number,
  requested?: SizeRequest
): WidgetSizeLimits {
  const floorWidth = Math.max(120, Math.ceil(width * AI_MIN_SIZE_RATIO))
  const floorHeight = Math.max(120, Math.ceil(height * AI_MIN_SIZE_RATIO))
  return {
    minWidth: Math.min(width, Math.max(requested?.minWidth ?? floorWidth, floorWidth)),
    minHeight: Math.min(height, Math.max(requested?.minHeight ?? floorHeight, floorHeight))
  }
}

export function effectiveMinSize(
  manifest: Pick<WidgetManifest, 'kind' | 'width' | 'height' | 'minWidth' | 'minHeight'>
): WidgetSizeLimits {
  if (manifest.kind === 'ai') {
    return minimumSizeFor(manifest.width, manifest.height, manifest)
  }
  return {
    minWidth: Math.max(1, manifest.minWidth ?? 120),
    minHeight: Math.max(1, manifest.minHeight ?? 80)
  }
}
