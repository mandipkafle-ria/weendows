import { app, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { BUILTIN_WIDGETS } from '../shared/builtins'
import { IPC, type AppInfo, type NativeCheckResult } from '../shared/ipc'
import { builtinTypeSchema, noArgsSchema, widgetIdSchema } from '../shared/schemas'
import { getEditMode, setEditMode } from './services/edit-mode'
import { runNativeSmokeTest } from './native/win32'
import log from './services/logger'
import type { NoticeService } from './services/notices'
import type { WidgetService } from './services/widget-service'
import type { LayoutService } from './windows/layout'
import { getSettingsWindow, showSettingsWindow } from './windows/settings-window'

export interface IpcServices {
  widgetService: WidgetService
  layout: LayoutService
  notices: NoticeService
}

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

function shellWidgetId(services: IpcServices, event: IpcMainEvent | IpcMainInvokeEvent): string {
  const widgetId = services.layout.widgetIdForSender(event.sender)
  if (!widgetId) {
    throw new Error('Unexpected shell IPC sender')
  }
  return widgetId
}

export function registerIpcHandlers(services: IpcServices): void {
  const channels = Object.values(IPC)
  for (const channel of channels) {
    ipcMain.removeHandler(channel)
    ipcMain.removeAllListeners(channel)
  }

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

  ipcMain.handle(IPC.getBuiltins, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return [...BUILTIN_WIDGETS]
  })

  ipcMain.handle(IPC.getWidgets, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.layout.getSummaries()
  })

  ipcMain.handle(IPC.addWidget, async (event, ...args) => {
    assertSettingsSender(event)
    const builtinType = builtinTypeSchema.parse(args[0])
    return services.layout.addWidget(builtinType)
  })

  ipcMain.handle(IPC.removeWidget, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    return services.layout.removeWidget(widgetId, getSettingsWindow())
  })

  ipcMain.handle(IPC.getEditMode, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return getEditMode()
  })

  ipcMain.handle(IPC.setEditMode, (event, ...args) => {
    assertSettingsSender(event)
    const enabled = z.boolean().parse(args[0])
    return setEditMode(enabled)
  })

  ipcMain.handle(IPC.getNotices, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.notices.list()
  })

  ipcMain.handle(IPC.shellGetState, (event, ...args) => {
    assertNoArgs(args)
    shellWidgetId(services, event)
    return services.layout.stateForSender(event.sender)
  })

  ipcMain.on(IPC.shellDragStart, (event) => {
    try {
      services.layout.startDrag(shellWidgetId(services, event))
    } catch (error) {
      log.warn('Rejected shell drag start', error)
    }
  })

  ipcMain.on(IPC.shellDragEnd, (event) => {
    try {
      shellWidgetId(services, event)
      services.layout.finishDrag()
    } catch (error) {
      log.warn('Rejected shell drag end', error)
    }
  })

  ipcMain.on(IPC.shellResizeStart, (event) => {
    try {
      services.layout.startResize(shellWidgetId(services, event))
    } catch (error) {
      log.warn('Rejected shell resize start', error)
    }
  })

  ipcMain.on(IPC.shellResizeEnd, (event) => {
    try {
      shellWidgetId(services, event)
      services.layout.finishResize()
    } catch (error) {
      log.warn('Rejected shell resize end', error)
    }
  })

  ipcMain.on(IPC.shellOpenSettings, (event) => {
    try {
      shellWidgetId(services, event)
      showSettingsWindow()
    } catch (error) {
      log.warn('Rejected shell open settings', error)
    }
  })

  ipcMain.on(IPC.shellRemove, (event) => {
    try {
      shellWidgetId(services, event)
      void services.layout.removeWidgetForSender(event.sender)
    } catch (error) {
      log.warn('Rejected shell remove', error)
    }
  })
}
