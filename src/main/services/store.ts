import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ZodType } from 'zod'

export interface JsonStoreOptions<T> {
  file: string
  schema: ZodType<T>
  defaults: () => T
  migrate?: (raw: unknown) => unknown
  onCorrupt?: (error: Error, backupPath: string) => void
  onWriteError?: (error: Error) => void
  debounceMs?: number
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export async function writeAtomicJson(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const serialized = JSON.stringify(data, null, 2)
  if (serialized === undefined) {
    throw new Error('Cannot serialize JSON value')
  }

  await writeFile(temporary, serialized, 'utf8')
  try {
    await rename(temporary, file)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

export class JsonStore<T> {
  readonly file: string
  hadFile = false
  recovered = false

  private data: T | null = null
  private timer: NodeJS.Timeout | null = null
  private writeChain: Promise<void> = Promise.resolve()
  private dirty = false
  private readonly debounceMs: number

  constructor(private readonly options: JsonStoreOptions<T>) {
    this.file = options.file
    this.debounceMs = options.debounceMs ?? 500
  }

  async load(): Promise<T> {
    if (this.data !== null) {
      return this.data
    }

    try {
      const raw = await readFile(this.options.file, 'utf8')
      this.hadFile = true
      const parsed: unknown = JSON.parse(raw)
      const migrated = this.options.migrate ? this.options.migrate(parsed) : parsed
      this.data = this.options.schema.parse(migrated)
      this.recovered = false
      return this.data
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        this.data = this.options.defaults()
        this.hadFile = false
        this.recovered = false
        return this.data
      }
      if (code) {
        throw error
      }

      this.data = this.options.defaults()
      this.hadFile = true
      this.recovered = true
      const backupPath = `${this.options.file}.corrupt-${Date.now()}`
      try {
        await rename(this.options.file, backupPath)
      } catch {
        this.options.onCorrupt?.(asError(error), this.options.file)
        return this.data
      }
      this.options.onCorrupt?.(asError(error), backupPath)
      return this.data
    }
  }

  get(): T {
    if (this.data === null) {
      throw new Error('Store has not been loaded')
    }
    return this.data
  }

  update(mutate: (data: T) => void): void {
    mutate(this.get())
    this.dirty = true
    this.schedule()
  }

  replace(data: T): void {
    this.data = data
    this.dirty = true
    this.schedule()
  }

  async flush(): Promise<void> {
    this.clearTimer()
    if (this.data === null || !this.dirty) {
      await this.writeChain
      return
    }

    this.dirty = false
    const snapshot = structuredClone(this.data)
    const write = this.writeChain.then(() => writeAtomicJson(this.options.file, snapshot))
    this.writeChain = write.catch(() => undefined)

    try {
      await write
    } catch (error) {
      this.dirty = true
      throw error
    }
  }

  async close(): Promise<void> {
    this.clearTimer()
    await this.flush()
  }

  private schedule(): void {
    this.clearTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush().catch((error: unknown) => {
        this.options.onWriteError?.(asError(error))
      })
    }, this.debounceMs)
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
