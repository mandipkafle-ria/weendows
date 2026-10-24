import { app, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC, type AppInfo, type NativeCheckResult } from '../shared/ipc'
import { noArgsSchema } from '../shared/schemas'
import { runNativeSmokeTest } from './native/win32'
import log from './services/logger'
import { getSettingsWindow } from './windows/settings-window'

function assertSettingsSender(event: IpcMainInvokeEvent): void {
  const settingsWindow = getSettingsWindow()
  if (
    !settingsWindow ||
    settingsWindow.isDestroyed() ||
    event.sender !== settingsWindow.webContents
  ) {
    throw new Error('Unexpected IPC sender')
  }
}

function assertNoArgs(args: unknown[]): void {
  noArgsSchema.parse(args[0])
}

export function registerIpcHandlers(): void {
  ipcMain.removeHandler(IPC.getAppInfo)
  ipcMain.removeHandler(IPC.nativeCheck)

  ipcMain.handle(IPC.getAppInfo, (event, ...args): AppInfo => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch
    }
  })

  ipcMain.handle(IPC.nativeCheck, (event, ...args): NativeCheckResult => {
    assertSettingsSender(event)
    assertNoArgs(args)

    try {
      const result = runNativeSmokeTest()
      log.info('Native check', result)
      return { ok: true, ...result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('Native check failed', message)
      return { ok: false, error: message }
    }
  })
}
