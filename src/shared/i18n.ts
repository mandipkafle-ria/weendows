export type MessageValues = Record<string, string | number>

export function translate(messages: unknown, path: string, values: MessageValues = {}): string {
  let value: unknown = messages
  for (const part of path.split('.')) {
    if (typeof value !== 'object' || value === null) {
      return path
    }
    value = (value as Record<string, unknown>)[part]
  }
  if (typeof value !== 'string') {
    return path
  }
  return value.replace(/\{(\w+)\}/g, (match, name: string) => {
    const replacement = values[name]
    return replacement === undefined ? match : String(replacement)
  })
}
