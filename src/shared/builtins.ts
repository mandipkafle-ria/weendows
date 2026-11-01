import type { BuiltinWidget, WidgetContentField, WidgetManifest, WidgetVariant } from './types'

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

function text(key: string, labelKey: string, multiline = false): WidgetContentField {
  return { key, labelKey, type: 'text', multiline }
}

function number(
  key: string,
  labelKey: string,
  min: number,
  max: number,
  step = 1
): WidgetContentField {
  return { key, labelKey, type: 'number', min, max, step }
}

function list(key: string, labelKey: string, itemFields: WidgetContentField[]): WidgetContentField {
  return { key, labelKey, type: 'list', itemFields }
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
  },
  {
    type: 'weekday',
    name: 'Weekday',
    description: 'The name of the day in six typographic moods.',
    category: 'time',
    width: 520,
    height: 240,
    minWidth: 340,
    minHeight: 160,
    variants: [
      variant('giant', 520, 240, 340, 160, ['large', 'bold', 'type']),
      variant('outline', 480, 240, 340, 160, ['outline', 'bold', 'type']),
      variant('serif', 460, 260, 320, 180, ['serif', 'editorial']),
      variant('vertical', 300, 330, 220, 240, ['vertical', 'minimal']),
      variant('thin', 500, 260, 340, 180, ['thin', 'minimal']),
      variant('marker', 320, 160, 240, 120, ['handwritten', 'warm'])
    ]
  },
  {
    type: 'week-strip',
    name: 'Week strip',
    description: 'A compact week with today held in focus.',
    category: 'time',
    width: 360,
    height: 120,
    minWidth: 280,
    minHeight: 90,
    variants: [
      variant('pills', 360, 120, 280, 90, ['week', 'calendar']),
      variant('dots', 360, 120, 280, 90, ['dots', 'minimal']),
      variant('underline', 340, 100, 280, 80, ['underline', 'minimal'])
    ]
  },
  {
    type: 'greeting',
    name: 'Greeting',
    description: 'A friendly hello that follows the time of day.',
    category: 'time',
    width: 420,
    height: 150,
    minWidth: 280,
    minHeight: 100,
    variants: [
      variant('bare', 420, 150, 280, 100, ['greeting', 'large']),
      variant('card', 420, 160, 300, 120, ['greeting', 'card'])
    ]
  },
  {
    type: 'countdown',
    name: 'Countdown',
    description: 'Days, hours and minutes until the next big moment.',
    category: 'time',
    width: 420,
    height: 220,
    minWidth: 320,
    minHeight: 180,
    variants: [
      variant('big', 420, 220, 320, 180, ['countdown', 'large']),
      variant('segments', 400, 200, 300, 160, ['countdown', 'segments']),
      variant('ring', 340, 300, 280, 260, ['countdown', 'ring'])
    ]
  },
  {
    type: 'time-progress',
    name: 'Time progress',
    description: 'How much of today, this month and this year has passed.',
    category: 'time',
    width: 380,
    height: 230,
    minWidth: 300,
    minHeight: 180,
    variants: [
      variant('bars', 380, 230, 300, 180, ['progress', 'bars']),
      variant('rings', 360, 220, 300, 190, ['progress', 'rings']),
      variant('dots', 360, 230, 300, 190, ['progress', 'dots'])
    ]
  },
  {
    type: 'moon',
    name: 'Moon phase',
    description: 'Tonight’s moon, computed from the date.',
    category: 'ambient',
    width: 280,
    height: 320,
    minWidth: 220,
    minHeight: 260,
    variants: [
      variant('disc', 280, 320, 220, 260, ['moon', 'astronomy']),
      variant('mini', 340, 140, 260, 110, ['moon', 'compact'])
    ]
  },
  {
    type: 'sun-arc',
    name: 'Sun arc',
    description: 'Sunrise, sunset and the sun’s place in the sky.',
    category: 'ambient',
    width: 360,
    height: 220,
    minWidth: 280,
    minHeight: 180,
    variants: [variant('arc', 360, 220, 280, 180, ['sun', 'daylight'])]
  },
  {
    type: 'world-clock',
    name: 'World clocks',
    description: 'The time in the cities that matter to you.',
    category: 'time',
    width: 360,
    height: 300,
    minWidth: 300,
    minHeight: 240,
    variants: [
      variant('list', 360, 300, 300, 240, ['world', 'clocks']),
      variant('tiles', 380, 300, 320, 260, ['world', 'tiles'])
    ]
  },
  {
    type: 'timer',
    name: 'Focus timer',
    description: 'A working pomodoro with focus and break rounds.',
    category: 'focus',
    width: 280,
    height: 330,
    minWidth: 240,
    minHeight: 280,
    variants: [
      variant('ring', 280, 330, 240, 280, ['timer', 'pomodoro']),
      variant('pill', 380, 110, 300, 90, ['timer', 'compact'])
    ],
    focusable: true
  },
  {
    type: 'word-clock',
    name: 'Word clock',
    description: 'The time written out in a grid of letters.',
    category: 'time',
    width: 360,
    height: 300,
    minWidth: 300,
    minHeight: 260,
    variants: [variant('word', 360, 300, 300, 260, ['word', 'clock'])]
  },
  {
    type: 'flip-clock',
    name: 'Flip clock',
    description: 'Split-flap digits that flip when the minute changes.',
    category: 'time',
    width: 360,
    height: 140,
    minWidth: 300,
    minHeight: 110,
    variants: [variant('flip', 360, 140, 300, 110, ['flip', 'clock'])]
  },
  {
    type: 'binary-clock',
    name: 'Binary clock',
    description: 'BCD time as six columns of binary dots.',
    category: 'time',
    width: 330,
    height: 220,
    minWidth: 280,
    minHeight: 180,
    variants: [variant('dots', 330, 220, 280, 180, ['binary', 'clock'])]
  },
  {
    type: 'activity',
    name: 'Activity rings',
    description: 'Move, exercise and stand goals as three rings.',
    category: 'focus',
    width: 360,
    height: 180,
    minWidth: 300,
    minHeight: 150,
    variants: [variant('rings', 360, 180, 300, 150, ['activity', 'rings'])]
  },
  {
    type: 'habits',
    name: 'Habits',
    description: 'A week of habits you tick off as you go.',
    category: 'focus',
    width: 360,
    height: 250,
    minWidth: 320,
    minHeight: 220,
    variants: [variant('week', 360, 250, 320, 220, ['habits', 'week'])],
    contentSchema: {
      fields: [list('habits', 'content.habits.habits', [text('name', 'content.habits.name')])]
    },
    contentDefaults: {
      habits: [{ name: 'Read' }, { name: 'Walk' }, { name: 'Write' }, { name: 'No sugar' }]
    },
    focusable: true,
    permissions: ['storage']
  },
  {
    type: 'water',
    name: 'Water',
    description: 'Eight glasses, one tap each, remembered for today.',
    category: 'focus',
    width: 340,
    height: 180,
    minWidth: 280,
    minHeight: 150,
    variants: [variant('cups', 340, 180, 280, 150, ['water', 'hydration'])],
    contentSchema: {
      fields: [
        number('cups', 'content.water.cups', 1, 16),
        number('ml', 'content.water.ml', 50, 1500, 50)
      ]
    },
    contentDefaults: { cups: 8, ml: 250 },
    focusable: true,
    permissions: ['storage']
  },
  {
    type: 'music',
    name: 'Now playing',
    description: 'A visual player with play, skip and a progress bar.',
    category: 'ambient',
    width: 340,
    height: 260,
    minWidth: 280,
    minHeight: 220,
    variants: [
      variant('card', 340, 260, 280, 220, ['music', 'player']),
      variant('mini', 360, 100, 300, 80, ['music', 'compact'])
    ],
    contentSchema: {
      fields: [
        number('length', 'content.music.length', 10, 7200, 1),
        list('tracks', 'content.music.tracks', [
          text('title', 'content.music.title'),
          text('artist', 'content.music.artist')
        ])
      ]
    },
    contentDefaults: {
      length: 213,
      tracks: [
        { title: 'Slow Orbit', artist: 'Halden' },
        { title: 'Paper Lanterns', artist: 'Mio Aoki' },
        { title: 'Low Tide Signals', artist: 'Kestrel' }
      ]
    },
    focusable: true
  },
  {
    type: 'agenda',
    name: 'Agenda',
    description: 'The day’s events as a timeline or the next one up.',
    category: 'time',
    width: 340,
    height: 280,
    minWidth: 300,
    minHeight: 240,
    variants: [
      variant('timeline', 340, 280, 300, 240, ['agenda', 'timeline']),
      variant('next', 320, 200, 280, 160, ['agenda', 'next'])
    ],
    contentSchema: {
      fields: [
        list('items', 'content.agenda.items', [
          text('time', 'content.agenda.time'),
          number('minutes', 'content.agenda.minutes', 5, 720, 5),
          text('title', 'content.agenda.title')
        ])
      ]
    },
    contentDefaults: {
      items: [
        { time: '08:30', minutes: 30, title: 'Standup' },
        { time: '10:00', minutes: 90, title: 'Design review' },
        { time: '12:30', minutes: 45, title: 'Lunch with Mira' },
        { time: '15:00', minutes: 120, title: 'Deep work' },
        { time: '18:00', minutes: 60, title: 'Gym' }
      ]
    }
  },
  {
    type: 'quote',
    name: 'Daily line',
    description: 'One original line, chosen by the day of the year.',
    category: 'ambient',
    width: 360,
    height: 220,
    minWidth: 280,
    minHeight: 160,
    variants: [
      variant('serif', 360, 220, 280, 160, ['quote', 'serif']),
      variant('bare', 480, 240, 320, 180, ['quote', 'large'])
    ],
    contentSchema: {
      fields: [text('text', 'content.quote.text', true), text('label', 'content.quote.label')]
    },
    contentDefaults: { text: 'Start before you feel ready.', label: 'Line of the day' }
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
