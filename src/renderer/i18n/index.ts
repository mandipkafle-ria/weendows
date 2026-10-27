import { translate, type MessageValues } from '../../shared/i18n'
import messages from './en.json'

export type { MessageValues }

export function t(path: string, values: MessageValues = {}): string {
  return translate(messages, path, values)
}
