import { readFile, rename } from 'node:fs/promises'
import { startupFileSchema } from '../../shared/schemas'
import type { SafeModeReason, StartupFile } from '../../shared/types'
import log from './logger'
import { writeAtomicJson } from './store'

export const STARTUP_CLEAN_AFTER_MS = 30_000
export const STARTUP_FAILURE_WINDOW_MS = 2 * 60_000
export const STARTUP_FAILURE_LIMIT = 3

export interface StartupEvaluation {
  safe: boolean
  reason: SafeModeReason
  failedStarts: number
}

export interface StartupStateSnapshot {
  failedStarts: number
  lastCleanAt: string | null
}

interface StartupServiceOptions {
  now?: () => number
  cleanAfterMs?: number
  failureWindowMs?: number
  failureLimit?: number
}

export class StartupService {
  private readonly file: string
  private readonly now: () => number
  private readonly cleanAfterMs: number
  private readonly failureWindowMs: number
  private readonly failureLimit: number
  private data: StartupFile = { schema: 1, attempts: [], lastCleanAt: null }
  private loaded = false
  private failedStarts = 0
  private cleanTimer: NodeJS.Timeout | null = null

  constructor(file: string, options: StartupServiceOptions = {}) {
    this.file = file
    this.now = options.now ?? Date.now
    this.cleanAfterMs = options.cleanAfterMs ?? STARTUP_CLEAN_AFTER_MS
    this.failureWindowMs = options.failureWindowMs ?? STARTUP_FAILURE_WINDOW_MS
    this.failureLimit = options.failureLimit ?? STARTUP_FAILURE_LIMIT
  }

  async begin(manualSafe: boolean): Promise<StartupEvaluation> {
    await this.load()
    const timestamp = this.now()
    this.data.attempts = this.data.attempts.filter(
      (attempt) => timestamp - attempt < this.failureWindowMs
    )
    this.failedStarts = this.data.attempts.length
    const autoSafe = !manualSafe && this.data.attempts.length >= this.failureLimit
    const reason: SafeModeReason = manualSafe ? 'flag' : autoSafe ? 'crashes' : null

    if (!autoSafe && !manualSafe) {
      this.data.attempts.push(timestamp)
      await this.save()
    }

    if (autoSafe) {
      log.warn('Entering safe mode after repeated failed startups', {
        failedStarts: this.failedStarts
      })
    }

    return {
      safe: manualSafe || autoSafe,
      reason,
      failedStarts: this.failedStarts
    }
  }

  startCleanTimer(): void {
    if (this.cleanTimer) {
      clearTimeout(this.cleanTimer)
    }
    this.cleanTimer = setTimeout(() => {
      this.cleanTimer = null
      void this.markClean()
    }, this.cleanAfterMs)
  }

  scheduleForcedCrash(safe: boolean): void {
    if (process.env['HL_FORCE_STARTUP_CRASH'] !== '1') {
      return
    }
    if (safe) {
      log.warn('Forced startup crash skipped because safe mode is active')
      return
    }
    log.warn('Forced startup crash scheduled by HL_FORCE_STARTUP_CRASH')
    setTimeout(() => {
      log.error('Forced startup crash for safe-mode testing')
      setTimeout(() => process.exit(1), 500)
    }, 2000)
  }

  async resetForStartNormally(): Promise<void> {
    await this.load()
    this.data.attempts = []
    this.data.lastCleanAt = new Date(this.now()).toISOString()
    this.failedStarts = 0
    await this.save()
  }

  snapshot(): StartupStateSnapshot {
    return {
      failedStarts: this.failedStarts,
      lastCleanAt: this.data.lastCleanAt
    }
  }

  stop(): void {
    if (this.cleanTimer) {
      clearTimeout(this.cleanTimer)
      this.cleanTimer = null
    }
  }

  private async markClean(): Promise<void> {
    this.data.attempts = []
    this.data.lastCleanAt = new Date(this.now()).toISOString()
    this.failedStarts = 0
    try {
      await this.save()
      log.info('Startup marked clean after 30 seconds')
    } catch (error) {
      log.warn('Could not mark startup as clean', error)
    }
  }

  private async load(): Promise<void> {
    if (this.loaded) {
      return
    }
    this.loaded = true
    try {
      const raw = await readFile(this.file, 'utf8')
      this.data = startupFileSchema.parse(JSON.parse(raw))
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        const backup = `${this.file}.corrupt-${Date.now()}`
        await rename(this.file, backup).catch(() => undefined)
        log.warn('startup.json was unreadable; startup history was reset', {
          backup,
          error: error instanceof Error ? error.message : String(error)
        })
      }
      this.data = { schema: 1, attempts: [], lastCleanAt: null }
    }
  }

  private async save(): Promise<void> {
    await writeAtomicJson(this.file, this.data)
  }
}
