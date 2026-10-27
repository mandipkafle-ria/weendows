import messages from '../renderer/i18n/en.json'
import { translate, type MessageValues } from '../shared/i18n'

export function t(path: string, values: MessageValues = {}): string {
  return translate(messages, path, values)
}
