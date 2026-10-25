export interface AppFlags {
  hidden: boolean
  safe: boolean
}

export function parseAppFlags(argv: readonly string[]): AppFlags {
  return {
    hidden: argv.includes('--hidden'),
    safe: argv.includes('--safe')
  }
}

export function parseWidgetCount(value: string | undefined = process.env.HL_WIDGET_COUNT): number {
  if (!value) {
    return 1
  }
  const count = Number.parseInt(value, 10)
  if (!Number.isFinite(count) || count < 0) {
    return 1
  }
  return Math.min(count, 10)
}
