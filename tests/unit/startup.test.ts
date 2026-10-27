import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STARTUP_FAILURE_LIMIT,
  STARTUP_FAILURE_WINDOW_MS,
  StartupService
} from '../../src/main/services/startup'
import type { StartupFile } from '../../src/shared/types'

vi.mock('../../src/main/services/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

const directories: string[] = []

async function makeFile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'homelayer-startup-'))
  directories.push(directory)
  return join(directory, 'startup.json')
}

async function readStartup(file: string): Promise<StartupFile> {
  return JSON.parse(await readFile(file, 'utf8')) as StartupFile
}

afterEach(async () => {
  vi.useRealTimers()
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

describe('StartupService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('tracks failed starts and enters safe mode at the limit', async () => {
    const file = await makeFile()
    for (let index = 0; index < STARTUP_FAILURE_LIMIT; index += 1) {
      const service = new StartupService(file, { now: () => 1_000 })
      const evaluation = await service.begin(false)
      expect(evaluation.safe).toBe(false)
      expect(evaluation.reason).toBeNull()
    }

    const service = new StartupService(file, { now: () => 1_000 })
    const evaluation = await service.begin(false)

    expect(evaluation).toMatchObject({
      safe: true,
      reason: 'crashes',
      failedStarts: STARTUP_FAILURE_LIMIT
    })
    expect((await readStartup(file)).attempts).toHaveLength(STARTUP_FAILURE_LIMIT)
  })

  it('does not count manual safe mode as a failed start', async () => {
    const file = await makeFile()
    const service = new StartupService(file, { now: () => 1_000 })
    const evaluation = await service.begin(true)

    expect(evaluation).toMatchObject({ safe: true, reason: 'flag', failedStarts: 0 })
    await expect(access(file)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('ignores attempts outside the failure window', async () => {
    const file = await makeFile()
    const first = new StartupService(file, { now: () => 1_000 })
    await first.begin(false)

    const later = new StartupService(file, {
      now: () => 1_000 + STARTUP_FAILURE_WINDOW_MS + 1
    })
    const evaluation = await later.begin(false)

    expect(evaluation.failedStarts).toBe(0)
    expect((await readStartup(file)).attempts).toEqual([1_000 + STARTUP_FAILURE_WINDOW_MS + 1])
  })

  it('clears failed starts after a clean startup', async () => {
    const file = await makeFile()
    const service = new StartupService(file, { cleanAfterMs: 10, now: () => 5_000 })
    await service.begin(false)

    service.startCleanTimer()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(service.snapshot()).toEqual({
      failedStarts: 0,
      lastCleanAt: new Date(5_000).toISOString()
    })
    expect((await readStartup(file)).attempts).toEqual([])
    service.stop()
  })

  it('resets history when starting normally from safe mode', async () => {
    const file = await makeFile()
    for (let index = 0; index < STARTUP_FAILURE_LIMIT; index += 1) {
      await new StartupService(file, { now: () => 1_000 }).begin(false)
    }

    const service = new StartupService(file, { now: () => 2_000 })
    await service.begin(true)
    await service.resetForStartNormally()

    const stored = await readStartup(file)
    expect(stored.attempts).toEqual([])
    expect(stored.lastCleanAt).toBe(new Date(2_000).toISOString())
    expect(service.snapshot().lastCleanAt).toBe(new Date(2_000).toISOString())
  })
})
