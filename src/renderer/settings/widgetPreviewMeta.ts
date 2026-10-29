import type { WidgetManifest } from '../../shared/types'
import type { PreviewSource } from './WidgetPreview'

/** Manifest -> the live preview source used by WidgetPreview. */
export function previewSourceFor(manifest: WidgetManifest): PreviewSource {
  if (manifest.kind === 'builtin' && manifest.builtinType) {
    return {
      kind: 'builtin',
      type: manifest.builtinType,
      variant: manifest.variant ?? 'classic'
    }
  }
  return { kind: 'widget', id: manifest.id }
}
