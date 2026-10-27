import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn(async () => undefined),
    openPath: vi.fn(async () => '')
  }
}))

import { shell } from 'electron'
import { launchScannedApp } from '../../src/main/services/app-launcher'
import type { ScannedApp } from '../../src/main/services/app-scanner'

function steamApp(steamAppId?: string): ScannedApp {
  return {
    id: 'a'.repeat(40),
    name: 'Deadlock',
    kind: 'steam',
    hidden: false,
    iconUrl: null,
    steamAppId
  }
}

describe('steam launch', () => {
  beforeEach(() => {
    vi.mocked(shell.openExternal).mockClear()
  })

  it('launches a game through the Steam URL scheme', async () => {
    await launchScannedApp(steamApp('1422450'))
    expect(shell.openExternal).toHaveBeenCalledWith('steam://rungameid/1422450')
  })

  it('rejects a missing or malformed Steam app id', async () => {
    await expect(launchScannedApp(steamApp())).rejects.toThrow('Steam app id is missing')
    await expect(launchScannedApp(steamApp('1; calc'))).rejects.toThrow('Steam app id is missing')
    expect(shell.openExternal).not.toHaveBeenCalled()
  })
})
