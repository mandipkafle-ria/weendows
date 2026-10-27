import { shell } from 'electron'
import { spawn } from 'node:child_process'
import type { ScannedApp } from './app-scanner'
import { WidgetApiError } from './widget-api-error'

export interface LaunchableApp {
  id: string
  name: string
  launch: () => Promise<void>
}

export function looksLikePath(value: string): boolean {
  return /[\\/:]/.test(value) || /\.(exe|lnk|bat|cmd|com|msi|ps1)$/i.test(value)
}

export async function launchScannedApp(entry: ScannedApp): Promise<void> {
  if (entry.kind === 'steam') {
    if (!entry.steamAppId || !/^\d+$/.test(entry.steamAppId)) {
      throw new Error('Steam app id is missing')
    }
    await shell.openExternal(`steam://rungameid/${entry.steamAppId}`)
    return
  }

  if (entry.kind === 'lnk') {
    if (!entry.launchPath) {
      throw new Error('Shortcut path is missing')
    }
    const error = await shell.openPath(entry.launchPath)
    if (error) {
      throw new Error(error)
    }
    return
  }

  if (!entry.appUserModelId) {
    throw new Error('Store app id is missing')
  }
  const child = spawn('explorer.exe', [`shell:AppsFolder\\${entry.appUserModelId}`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  })
  child.unref()
}

export class AppLauncher {
  private readonly apps = new Map<string, LaunchableApp>()

  setApps(apps: readonly LaunchableApp[]): void {
    this.apps.clear()
    for (const app of apps) {
      this.apps.set(app.id, app)
    }
  }

  list(): LaunchableApp[] {
    return [...this.apps.values()]
  }

  async launch(rawAppId: unknown): Promise<boolean> {
    if (typeof rawAppId !== 'string' || rawAppId.length === 0 || rawAppId.length > 128) {
      throw new WidgetApiError('invalid_args', 'appId must be a string')
    }
    if (looksLikePath(rawAppId)) {
      throw new WidgetApiError('invalid_args', 'appId must be an app id, not a path')
    }

    const app = this.apps.get(rawAppId)
    if (!app) {
      throw new WidgetApiError('not_found', 'app is not in the scanner list')
    }

    try {
      await app.launch()
      return true
    } catch {
      throw new WidgetApiError('internal', 'could not launch the app')
    }
  }
}
