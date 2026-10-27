import { readFile, rename } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import {
  WIDGET_ID_RE,
  WIDGET_STORAGE_KEY_MAX,
  WIDGET_STORAGE_TOTAL_BYTES,
  WIDGET_STORAGE_VALUE_MAX
} from '../../shared/constants'
import log from './logger'
import { writeAtomicJson } from './store'
import { WidgetApiError } from './widget-api-error'

interface StoredWidgetData {
  values: Map<string, unknown>
  loaded: boolean
}

export function storageFilePath(widgetsDir: string, widgetId: string): string | null {
  if (!WIDGET_ID_RE.test(widgetId)) {
    return null
  }

  const root = resolve(widgetsDir)
  const file = resolve(root, widgetId, 'storage.json')
  if (!file.startsWith(root + sep)) {
    return null
  }
  return file
}

export function validateStorageKey(key: unknown): string {
  if (typeof key !== 'string' || key.length === 0 || key.length > WIDGET_STORAGE_KEY_MAX) {
    throw new WidgetApiError(
      'invalid_args',
      `storage key must be 1 to ${WIDGET_STORAGE_KEY_MAX} characters`
    )
  }
  return key
}

export function jsonByteSize(value: unknown): number | null {
  let serialized: string | undefined
  try {
    serialized = JSON.stringify(value)
  } catch {
    return null
  }
  if (serialized === undefined) {
    return null
  }
  return Buffer.byteLength(serialized)
}

function serializedValues(values: Map<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(values)
}

export class WidgetStorageService {
  private readonly widgetsDir: string
  private readonly stores = new Map<string, StoredWidgetData>()
  private readonly chains = new Map<string, Promise<unknown>>()

  constructor(widgetsDir: string) {
    this.widgetsDir = widgetsDir
  }

  async get(widgetId: string, rawKey: unknown): Promise<unknown> {
    const key = validateStorageKey(rawKey)
    return this.withLock(widgetId, async () => {
      const data = await this.load(widgetId)
      return data.values.has(key) ? data.values.get(key) : null
    })
  }

  async set(widgetId: string, rawKey: unknown, value: unknown): Promise<boolean> {
    const key = validateStorageKey(rawKey)
    const valueSize = jsonByteSize(value)
    if (valueSize === null) {
      throw new WidgetApiError('invalid_args', 'storage value must be JSON')
    }
    if (valueSize > WIDGET_STORAGE_VALUE_MAX) {
      throw new WidgetApiError('too_large', 'storage value is larger than 64 KB')
    }

    return this.withLock(widgetId, async () => {
      const data = await this.load(widgetId)
      const next = new Map(data.values)
      next.set(key, value)
      const total = Buffer.byteLength(JSON.stringify(serializedValues(next)))
      if (total > WIDGET_STORAGE_TOTAL_BYTES) {
        throw new WidgetApiError('too_large', 'widget storage is larger than 256 KB')
      }

      await this.write(widgetId, next)
      data.values = next
      return true
    })
  }

  async remove(widgetId: string, rawKey: unknown): Promise<boolean> {
    const key = validateStorageKey(rawKey)
    return this.withLock(widgetId, async () => {
      const data = await this.load(widgetId)
      if (!data.values.has(key)) {
        return false
      }
      const next = new Map(data.values)
      next.delete(key)
      await this.write(widgetId, next)
      data.values = next
      return true
    })
  }

  async keys(widgetId: string): Promise<string[]> {
    return this.withLock(widgetId, async () => {
      const data = await this.load(widgetId)
      return [...data.values.keys()]
    })
  }

  private async withLock<T>(widgetId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(widgetId) ?? Promise.resolve()
    const next = previous.then(action, action)
    this.chains.set(
      widgetId,
      next.catch(() => undefined)
    )
    return next
  }

  private async load(widgetId: string): Promise<StoredWidgetData> {
    const cached = this.stores.get(widgetId)
    if (cached) {
      return cached
    }

    const file = storageFilePath(this.widgetsDir, widgetId)
    if (!file) {
      throw new WidgetApiError('invalid_args', 'invalid widget id')
    }

    const data: StoredWidgetData = { values: new Map(), loaded: true }
    try {
      const raw = await readFile(file, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          data.values.set(key, value)
        }
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        const backup = `${file}.corrupt-${Date.now()}`
        await rename(file, backup).catch(() => undefined)
        log.warn('Widget storage was unreadable; starting empty', { widgetId, backup })
      }
    }

    this.stores.set(widgetId, data)
    return data
  }

  private async write(widgetId: string, values: Map<string, unknown>): Promise<void> {
    const file = storageFilePath(this.widgetsDir, widgetId)
    if (!file) {
      throw new WidgetApiError('invalid_args', 'invalid widget id')
    }
    await writeAtomicJson(file, serializedValues(values))
  }
}
