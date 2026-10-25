import type { BuiltinWidget } from './types'

export const BUILTIN_WIDGETS: readonly BuiltinWidget[] = [
  {
    type: 'clock',
    name: 'Clock',
    description: 'Local time with the current weekday and date.',
    width: 240,
    height: 140,
    minWidth: 160,
    minHeight: 100
  },
  {
    type: 'date',
    name: 'Date',
    description: 'A larger look at today, the weekday and the year.',
    width: 240,
    height: 140,
    minWidth: 160,
    minHeight: 100
  },
  {
    type: 'calendar',
    name: 'Calendar',
    description: 'A month grid with today highlighted.',
    width: 240,
    height: 280,
    minWidth: 210,
    minHeight: 230
  }
]

export function findBuiltin(type: string): BuiltinWidget | undefined {
  return BUILTIN_WIDGETS.find((widget) => widget.type === type)
}
