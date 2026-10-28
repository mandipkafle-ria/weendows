import type { BuiltinWidget, WidgetManifest, WidgetVariant } from './types'

function variant(
  id: string,
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
  tags: string[] = []
): WidgetVariant {
  return { id, width, height, minWidth, minHeight, tags }
}

export const BUILTIN_WIDGETS: readonly BuiltinWidget[] = [
  {
    type: 'clock',
    name: 'Clock',
    description: 'Local time with the current weekday and date.',
    category: 'time',
    width: 240,
    height: 140,
    minWidth: 160,
    minHeight: 100,
    variants: [
      variant('classic', 240, 140, 160, 100, ['digital', 'clean']),
      variant('minimal', 300, 120, 200, 90, ['digital', 'minimal']),
      variant('neon', 300, 160, 200, 120, ['digital', 'neon', 'colorful']),
      variant('analog', 240, 240, 180, 180, ['analog', 'classic']),
      variant('terminal', 300, 160, 220, 120, ['digital', 'terminal', 'monospace'])
    ]
  },
  {
    type: 'date',
    name: 'Date',
    description: 'A larger look at today, the weekday and the year.',
    category: 'time',
    width: 240,
    height: 140,
    minWidth: 160,
    minHeight: 100,
    variants: [
      variant('classic', 240, 140, 160, 100, ['digital', 'clean']),
      variant('editorial', 320, 200, 240, 150, ['editorial', 'large']),
      variant('minimal', 240, 120, 180, 90, ['minimal', 'clean'])
    ]
  },
  {
    type: 'calendar',
    name: 'Calendar',
    description: 'A month grid with today highlighted.',
    category: 'time',
    width: 280,
    height: 300,
    minWidth: 240,
    minHeight: 250,
    variants: [
      variant('grid', 280, 300, 240, 250, ['calendar', 'dense']),
      variant('compact', 280, 210, 220, 180, ['compact', 'dense']),
      variant('paper', 300, 320, 240, 260, ['paper', 'warm'])
    ]
  },
  {
    type: 'system',
    name: 'System',
    description: 'CPU and memory use, sampled every two seconds.',
    category: 'system',
    width: 240,
    height: 160,
    minWidth: 180,
    minHeight: 120,
    variants: [
      variant('dots', 240, 160, 180, 120, ['dots', 'compact']),
      variant('bars', 280, 180, 200, 140, ['bars', 'data']),
      variant('rings', 260, 190, 200, 160, ['rings', 'data']),
      variant('terminal', 300, 180, 220, 140, ['terminal', 'monospace'])
    ],
    permissions: ['system.stats']
  },
  {
    type: 'battery',
    name: 'Battery',
    description: 'Battery level and charging state.',
    category: 'system',
    width: 240,
    height: 160,
    minWidth: 180,
    minHeight: 120,
    variants: [
      variant('ring', 240, 160, 180, 120, ['ring', 'battery']),
      variant('bar', 280, 120, 200, 100, ['bar', 'battery']),
      variant('minimal', 240, 100, 160, 80, ['minimal', 'battery'])
    ],
    permissions: ['system.battery']
  },
  {
    type: 'notes',
    name: 'Notes',
    description: 'A scratch pad that saves to this widget’s private storage.',
    category: 'focus',
    width: 280,
    height: 220,
    minWidth: 200,
    minHeight: 160,
    variants: [
      variant('warm', 280, 220, 200, 160, ['warm', 'notes']),
      variant('paper', 300, 240, 220, 180, ['paper', 'notes']),
      variant('slate', 280, 200, 200, 150, ['slate', 'notes'])
    ],
    focusable: true,
    permissions: ['storage']
  },
  {
    type: 'weather',
    name: 'Weather',
    description: 'Current conditions for a city, using Open-Meteo.',
    category: 'ambient',
    width: 300,
    height: 220,
    minWidth: 220,
    minHeight: 180,
    variants: [
      variant('classic', 300, 220, 240, 180, ['weather', 'classic']),
      variant('compact', 280, 140, 200, 120, ['weather', 'compact']),
      variant('station', 320, 240, 240, 200, ['weather', 'station'])
    ],
    focusable: true,
    permissions: ['network', 'storage'],
    allowedHosts: ['geocoding-api.open-meteo.com', 'api.open-meteo.com']
  },
  {
    type: 'app-grid',
    name: 'Apps',
    description: 'Installed apps with bundles that open like folders.',
    category: 'apps',
    width: 384,
    height: 280,
    minWidth: 320,
    minHeight: 180,
    variants: [
      variant('classic', 384, 280, 320, 180, ['apps', 'launcher', 'classic']),
      variant('monochrome', 384, 280, 320, 180, ['apps', 'monochrome', 'bw', 'minimal']),
      variant('glass', 384, 280, 320, 180, ['apps', 'glass', 'frosted', 'modern']),
      variant('cyberpunk', 396, 288, 320, 180, ['apps', 'neon', 'cyberpunk', 'glow']),
      variant('minimal', 360, 240, 280, 160, ['apps', 'minimal', 'compact', 'clean']),
      variant('retro', 384, 280, 320, 180, ['apps', 'retro', 'paper', 'warm'])
    ],
    focusable: true,
    editPassthrough: true,
    permissions: ['launch']
  }
]

export function findBuiltin(type: string): BuiltinWidget | undefined {
  return BUILTIN_WIDGETS.find((widget) => widget.type === type)
}

export function findBuiltinVariant(
  builtin: BuiltinWidget,
  variantId: string | undefined
): WidgetVariant {
  if (!variantId) {
    return (
      builtin.variants[0] ?? {
        id: 'classic',
        width: builtin.width,
        height: builtin.height,
        minWidth: builtin.minWidth,
        minHeight: builtin.minHeight
      }
    )
  }
  return (
    builtin.variants.find((item) => item.id === variantId) ??
    builtin.variants[0] ?? {
      id: 'classic',
      width: builtin.width,
      height: builtin.height,
      minWidth: builtin.minWidth,
      minHeight: builtin.minHeight
    }
  )
}

export function builtinVariant(
  builtinType: string | undefined,
  variantId: string | undefined
): WidgetVariant | null {
  if (!builtinType) {
    return null
  }
  const builtin = findBuiltin(builtinType)
  return builtin ? findBuiltinVariant(builtin, variantId) : null
}

export function isFocusableWidget(manifest: WidgetManifest): boolean {
  if (typeof manifest.focusable === 'boolean') {
    return manifest.focusable
  }
  if (manifest.builtinType) {
    return findBuiltin(manifest.builtinType)?.focusable ?? false
  }
  return false
}

export function isEditPassthroughWidget(manifest: WidgetManifest): boolean {
  if (typeof manifest.editPassthrough === 'boolean') {
    return manifest.editPassthrough
  }
  if (manifest.builtinType) {
    return findBuiltin(manifest.builtinType)?.editPassthrough ?? false
  }
  return false
}
