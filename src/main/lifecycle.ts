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
