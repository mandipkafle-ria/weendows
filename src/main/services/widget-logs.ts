import { WIDGET_LOG_LIMIT, WIDGET_LOG_MESSAGE_MAX } from '../../shared/constants'
import type { WidgetLogEntry } from '../../shared/types'
import { WidgetApiError } from './widget-api-error'

const LEVELS = new Set(['debug', 'info', 'warn', 'error'])

export class WidgetLogService {
  private readonly logs = new Map<string, WidgetLogEntry[]>()

  add(widgetId: string, rawLevel: unknown, rawMessage: unknown): void {
    if (typeof rawLevel !== 'string' || !LEVELS.has(rawLevel)) {
      throw new WidgetApiError('invalid_args', 'log level must be debug, info, warn or error')
    }
    if (typeof rawMessage !== 'string') {
      throw new WidgetApiError('invalid_args', 'log message must be a string')
    }

    const entry: WidgetLogEntry = {
      level: rawLevel,
      message: rawMessage.slice(0, WIDGET_LOG_MESSAGE_MAX),
      at: new Date().toISOString()
    }
    const entries = this.logs.get(widgetId) ?? []
    entries.push(entry)
    if (entries.length > WIDGET_LOG_LIMIT) {
      entries.splice(0, entries.length - WIDGET_LOG_LIMIT)
    }
    this.logs.set(widgetId, entries)
  }

  get(widgetId: string): WidgetLogEntry[] {
    return [...(this.logs.get(widgetId) ?? [])]
  }

  forget(widgetId: string): void {
    this.logs.delete(widgetId)
  }
}
