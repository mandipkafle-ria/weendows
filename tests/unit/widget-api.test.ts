import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getLocale: () => 'en-US' },
  BrowserWindow: { fromWebContents: () => null },
  dialog: {
    showMessageBox: vi.fn(async () => ({ response: 0, checkboxChecked: false }))
  },
  nativeTheme: { shouldUseDarkColors: false },
  powerMonitor: { isOnBatteryPower: () => false },
  shell: { openExternal: vi.fn(async () => undefined) }
}))

import { dialog, shell, type WebContents } from 'electron'
import { AppLauncher } from '../../src/main/services/app-launcher'
import type { AppGridService } from '../../src/main/services/app-grid-service'
import type { AppScanner } from '../../src/main/services/app-scanner'
import { WidgetApiService } from '../../src/main/services/widget-api'
import type { LayoutService } from '../../src/main/windows/layout'
import type { NetProxy } from '../../src/main/services/net-proxy'
import type { SystemStatsSampler } from '../../src/main/services/system-stats'
import type { WidgetService } from '../../src/main/services/widget-service'
import type { WidgetStorageService } from '../../src/main/services/widget-storage'
import type { WidgetManifest } from '../../src/shared/types'
import type { BundlePopoverService } from '../../src/main/windows/popover-window'

const sender = {} as WebContents

const appScanner = { list: () => [], refresh: async () => [] } as unknown as AppScanner
const appGrid = {} as AppGridService
const popover = {} as BundlePopoverService

function serviceFor(layout: LayoutService, launcher = new AppLauncher()): WidgetApiService {
  return new WidgetApiService({
    layout,
    widgetService: {} as WidgetService,
    storage: {} as WidgetStorageService,
    stats: {} as SystemStatsSampler,
    net: {} as NetProxy,
    launcher,
    appScanner,
    appGrid,
    popover
  })
}

function openLinkService(
  options: { granted?: boolean; now?: () => number } = {}
): WidgetApiService {
  const layout = { widgetIdForSender: () => 'probe' } as unknown as LayoutService
  const manifest = {
    id: 'probe',
    permissions: ['openLink'],
    grantedPermissions: options.granted === false ? [] : ['openLink'],
    allowedHosts: []
  } as unknown as WidgetManifest
  const widgetService = {
    getManifest: () => manifest
  } as unknown as WidgetService

  return new WidgetApiService({
    layout,
    widgetService,
    storage: {} as WidgetStorageService,
    stats: {} as SystemStatsSampler,
    net: {} as NetProxy,
    launcher: new AppLauncher(),
    appScanner,
    appGrid,
    popover,
    now: options.now ?? Date.now
  })
}

async function callOpenLink(api: WidgetApiService, url: string): Promise<unknown> {
  return api.handle(sender, { method: 'openLink', params: { url } })
}

describe('widget API sender checks', () => {
  it('rejects calls from a window that is not a widget shell', async () => {
    const layout = { widgetIdForSender: () => null } as unknown as LayoutService
    const response = await serviceFor(layout).handle(sender, { method: 'ready', params: {} })
    expect(response).toEqual({
      ok: false,
      error: { code: 'permission_denied', message: 'Unknown widget sender' }
    })
  })

  it('rejects launch.app paths and unknown app ids', async () => {
    const layout = { widgetIdForSender: () => 'clock' } as unknown as LayoutService
    const manifest = {
      id: 'clock',
      grantedPermissions: ['launch'],
      allowedHosts: []
    } as unknown as WidgetManifest
    const widgetService = {
      getManifest: () => manifest
    } as unknown as WidgetService
    const api = new WidgetApiService({
      layout,
      widgetService,
      storage: {} as WidgetStorageService,
      stats: {} as SystemStatsSampler,
      net: {} as NetProxy,
      launcher: new AppLauncher(),
      appScanner,
      appGrid,
      popover
    })

    await expect(
      api.handle(sender, { method: 'launch.app', params: { appId: 'C:\\Windows\\notepad.exe' } })
    ).resolves.toMatchObject({ ok: false, error: { code: 'invalid_args' } })
    await expect(
      api.handle(sender, { method: 'launch.app', params: { appId: 'not-installed' } })
    ).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } })
  })
})

describe('openLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prompts once, opens the approved URL, and enforces the 3-second limit', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 1,
      checkboxChecked: false
    })
    let now = 10_000
    const api = openLinkService({ now: () => now })

    await expect(callOpenLink(api, 'https://example.com/one')).resolves.toEqual({
      ok: true,
      result: { ok: true }
    })
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(1)
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/one')

    const prompt = vi.mocked(dialog.showMessageBox).mock.calls[0]?.[0] as {
      message?: string
    }
    expect(prompt.message).toContain('example.com')

    await expect(callOpenLink(api, 'https://example.org/two')).resolves.toMatchObject({
      ok: false,
      error: { code: 'rate_limited' }
    })
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(1)
    expect(shell.openExternal).toHaveBeenCalledTimes(1)

    now += 3_000
    await expect(callOpenLink(api, 'https://example.org/three')).resolves.toEqual({
      ok: true,
      result: { ok: true }
    })
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(1)
    expect(shell.openExternal).toHaveBeenLastCalledWith('https://example.org/three')
  })

  it('returns permission_denied when the user cancels the prompt', async () => {
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
      response: 0,
      checkboxChecked: false
    })
    const api = openLinkService({ now: () => 10_000 })

    await expect(callOpenLink(api, 'https://example.com/cancelled')).resolves.toEqual({
      ok: false,
      error: { code: 'permission_denied', message: 'opening links was not approved' }
    })
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('rejects widgets without granted openLink permission', async () => {
    const api = openLinkService({ granted: false, now: () => 10_000 })

    await expect(callOpenLink(api, 'https://example.com/no-permission')).resolves.toEqual({
      ok: false,
      error: { code: 'permission_denied', message: 'permission not granted: openLink' }
    })
    expect(dialog.showMessageBox).not.toHaveBeenCalled()
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('rejects non-http, local-file and credential URLs before prompting', async () => {
    const api = openLinkService({ now: () => 10_000 })

    for (const url of [
      'ftp://example.com/file',
      'file:///C:/Windows/notepad.exe',
      'https://user:secret@example.com/'
    ]) {
      await expect(callOpenLink(api, url)).resolves.toMatchObject({
        ok: false,
        error: { code: 'invalid_args' }
      })
    }

    expect(dialog.showMessageBox).not.toHaveBeenCalled()
    expect(shell.openExternal).not.toHaveBeenCalled()
  })
})
