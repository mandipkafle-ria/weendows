import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportDiagnostics } from '../../src/main/services/diagnostics'

const state = vi.hoisted(() => ({
  userData: '',
  openPath: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.2.3',
    getPath: () => state.userData
  },
  shell: {
    openPath: state.openPath
  }
}))

vi.mock('../../src/main/services/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

const directories: string[] = []

async function makeLogs(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'homelayer-diagnostics-'))
  directories.push(root)
  state.userData = root
  const logs = join(root, 'logs')
  await mkdir(logs)
  for (const [name, minute] of [
    ['old.log', 1],
    ['newest.log', 4],
    ['middle.log', 3],
    ['other.log', 2]
  ] as const) {
    const path = join(logs, name)
    await writeFile(path, name, 'utf8')
    const time = new Date(2026, 0, 1, 12, minute)
    await utimes(path, time, time)
  }
  return root
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
  vi.clearAllMocks()
})

describe('exportDiagnostics', () => {
  beforeEach(() => {
    state.openPath.mockResolvedValue('')
  })

  it('copies the three newest logs and writes version information', async () => {
    await makeLogs()
    const result = await exportDiagnostics()

    const entries = (await readdir(result.folder)).sort()
    expect(entries).toEqual(['middle.log', 'newest.log', 'other.log', 'versions.txt'])
    expect(result.files).toHaveLength(4)

    const versions = await readFile(join(result.folder, 'versions.txt'), 'utf8')
    expect(versions).toContain('HomeLayer: 1.2.3')
    expect(versions).toContain('Electron:')
    expect(versions).toContain('Chromium:')
    expect(state.openPath).toHaveBeenCalledWith(result.folder)
  })

  it('still exports versions when the logs folder is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'homelayer-diagnostics-empty-'))
    directories.push(root)
    state.userData = root

    const result = await exportDiagnostics()

    expect(await readdir(result.folder)).toEqual(['versions.txt'])
    expect(result.files).toHaveLength(1)
  })
})
