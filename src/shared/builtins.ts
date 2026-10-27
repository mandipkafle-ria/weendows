import type { BuiltinWidget, WidgetManifest, WidgetVariant } from './types'

function variant(
  id: string,
  width: number,
  height: number,
  minWidth: number,
  minHeight: number
): WidgetVariant {
  return { id, width, height, minWidth, minHeight }
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
      variant('classic', 240, 140, 160, 100),
      variant('minimal', 300, 120, 200, 90),
      variant('neon', 300, 160, 200, 120),
      variant('analog', 240, 240, 180, 180),
      variant('terminal', 300, 160, 220, 120)
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
      variant('classic', 240, 140, 160, 100),
      variant('editorial', 320, 200, 240, 150),
      variant('minimal', 240, 120, 180, 90)
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
      variant('grid', 280, 300, 240, 250),
      variant('compact', 280, 210, 220, 180),
      variant('paper', 300, 320, 240, 260)
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
      variant('dots', 240, 160, 180, 120),
      variant('bars', 280, 180, 200, 140),
      variant('rings', 260, 190, 200, 160),
      variant('terminal', 300, 180, 220, 140)
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
      variant('ring', 240, 160, 180, 120),
      variant('bar', 280, 120, 200, 100),
      variant('minimal', 240, 100, 160, 80)
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
      variant('warm', 280, 220, 200, 160),
      variant('paper', 300, 240, 220, 180),
      variant('slate', 280, 200, 200, 150)
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
      variant('classic', 300, 220, 240, 180),
      variant('compact', 280, 140, 200, 120),
      variant('station', 320, 240, 240, 200)
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
    variants: [variant('classic', 384, 280, 320, 180)],
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
