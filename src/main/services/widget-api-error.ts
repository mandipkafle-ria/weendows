import type { WidgetApiErrorCode } from '../../shared/types'

export class WidgetApiError extends Error {
  readonly code: WidgetApiErrorCode

  constructor(code: WidgetApiErrorCode, message: string) {
    super(message)
    this.name = 'WidgetApiError'
    this.code = code
  }
}
