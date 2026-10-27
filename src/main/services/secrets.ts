import { safeStorage } from 'electron'
import { readFile, rename, rm } from 'node:fs/promises'
import type { AiProvider } from '../../shared/types'
import log from './logger'
import { writeAtomicJson } from './store'

interface SecretsFile {
  schema: 1
  keys: Partial<Record<AiProvider, string>>
}

const EMPTY: SecretsFile = { schema: 1, keys: {} }

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export class SecretsService {
  private readonly file: string
  private data: SecretsFile = structuredClone(EMPTY)
  private loaded = false

  constructor(file: string) {
    this.file = file
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return
    }
    this.loaded = true

    try {
      const raw = await readFile(this.file, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed as { schema?: unknown }).schema === 1 &&
        (parsed as { keys?: unknown }).keys &&
        typeof (parsed as { keys: unknown }).keys === 'object'
      ) {
        const keys = (parsed as { keys: Record<string, unknown> }).keys
        const next: Partial<Record<AiProvider, string>> = {}
        for (const provider of ['gemini', 'openai-compat'] as const) {
          const value = keys[provider]
          if (typeof value === 'string' && value.length > 0) {
            next[provider] = value
          }
        }
        this.data = { schema: 1, keys: next }
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        const backup = `${this.file}.corrupt-${Date.now()}`
        await rename(this.file, backup).catch(() => undefined)
        log.warn('secrets.json was unreadable; AI keys were cleared', {
          backup,
          error: asError(error).message
        })
      }
      this.data = structuredClone(EMPTY)
    }
  }

  hasKey(provider: AiProvider): boolean {
    return typeof this.data.keys[provider] === 'string'
  }

  getEncryptedKey(provider: AiProvider): string | null {
    return this.data.keys[provider] ?? null
  }

  async saveKey(provider: AiProvider, key: string): Promise<void> {
    const trimmed = key.trim()
    if (trimmed.length === 0) {
      await this.removeKey(provider)
      return
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is unavailable on this system. The API key was not saved.')
    }

    const encrypted = safeStorage.encryptString(trimmed).toString('base64')
    this.data = {
      schema: 1,
      keys: { ...this.data.keys, [provider]: encrypted }
    }
    await writeAtomicJson(this.file, this.data)
  }

  async removeKey(provider: AiProvider): Promise<void> {
    const keys = { ...this.data.keys }
    delete keys[provider]
    this.data = { schema: 1, keys }
    if (Object.keys(keys).length === 0) {
      await rm(this.file, { force: true })
      return
    }
    await writeAtomicJson(this.file, this.data)
  }
}
