import {
  app,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import { z } from 'zod'
import { BUILTIN_WIDGETS } from '../shared/builtins'
import { IPC, type AppInfo, type NativeCheckResult } from '../shared/ipc'
import {
  accentColorSchema,
  acceleratorSchema,
  aiApprovalSchema,
  aiInstructionSchema,
  aiKeySchema,
  aiPromptSchema,
  aiProviderSchema,
  aiSettingsSchema,
  appIdSchema,
  builtinTypeSchema,
  bundleNameSchema,
  cursorStyleSchema,
  gridIndexSchema,
  noArgsSchema,
  permissionSchema,
  themeSourceSchema,
  wallpaperFitSchema,
  wallpaperIdSchema,
  wallpaperLiveOptionsSchema,
  wallpaperSlideshowSchema,
  widgetIdSchema,
  widgetVariantSchema
} from '../shared/schemas'
import type { AppsAndBundlesState, GeneralState, SafeModeReason } from '../shared/types'
import { t } from './i18n'
import { getEditMode, setEditMode } from './services/edit-mode'
import { runNativeSmokeTest } from './native/win32'
import type { SystemCursorService } from './native/system-cursor'
import log from './services/logger'
import type { AiService } from './services/ai-service'
import type { AppGridService } from './services/app-grid-service'
import type { AppScanner } from './services/app-scanner'
import type { AppSettingsService } from './services/app-settings'
import { exportDiagnostics } from './services/diagnostics'
import type { HotkeyService } from './hotkeys'
import { readLicenses } from './services/licenses'
import type { NoticeService } from './services/notices'
import type { StartupService } from './services/startup'
import type { WallpaperService } from './services/wallpaper-service'
import type { WidgetApiService } from './services/widget-api'
import type { WidgetService } from './services/widget-service'
import type { LayoutService } from './windows/layout'
import type { BundlePopoverService } from './windows/popover-window'
import { getSettingsWindow, showSettingsWindow } from './windows/settings-window'

export interface IpcServices {
  widgetService: WidgetService
  widgetApi: WidgetApiService
  layout: LayoutService
  notices: NoticeService
  ai: AiService
  popover: BundlePopoverService
  wallpaper: WallpaperService
  appSettings: AppSettingsService
  systemCursor: SystemCursorService
  startup: StartupService
  hotkeys: HotkeyService
  scanner: AppScanner
  appGrid: AppGridService
  safeMode: boolean
  safeModeReason: SafeModeReason
}

function generalState(services: IpcServices): GeneralState {
  const settings = services.appSettings.get()
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    theme: settings.theme,
    resolvedTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    accent: settings.accent,
    cursorStyle: settings.cursorStyle,
    cursorSystemWide: settings.cursorSystemWide,
    hotkey: settings.hotkey,
    loginItemAvailable: app.isPackaged,
    loginItemEnabled: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false,
    safeMode: services.safeMode,
    safeModeReason: services.safeModeReason,
    failedStarts: services.startup.snapshot().failedStarts,
    onboardingCompleted: settings.onboardingCompleted,
    dataFolder: app.getPath('userData')
  }
}

function appsAndBundlesState(services: IpcServices): AppsAndBundlesState {
  const apps = services.scanner.list()
  return {
    apps,
    hiddenCount: apps.filter((entry) => entry.hidden).length,
    bundles: services.appGrid.listBundles(),
    scanning: services.scanner.isScanning(),
    lastScanAt: services.scanner.lastScanTime()
  }
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

  ipcMain.handle(IPC.settingsGetGeneral, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsSetTheme, async (event, ...args) => {
    assertSettingsSender(event)
    const theme = themeSourceSchema.parse(args[0])
    await services.appSettings.setTheme(theme)
    nativeTheme.themeSource = theme
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsSetAccent, async (event, ...args) => {
    assertSettingsSender(event)
    const accent = accentColorSchema.parse(args[0])
    await services.appSettings.setAccent(accent)
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsSetCursorStyle, async (event, ...args) => {
    assertSettingsSender(event)
    const cursorStyle = cursorStyleSchema.parse(args[0])
    const settings = services.appSettings.get()
    if (settings.cursorSystemWide) {
      services.systemCursor.apply(cursorStyle)
      if (cursorStyle === 'system') {
        await services.appSettings.setCursorSystemWide(false)
      }
    }
    await services.appSettings.setCursorStyle(cursorStyle)
    services.layout.broadcastState()
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsSetCursorSystemWide, async (event, ...args) => {
    assertSettingsSender(event)
    const enabled = z.boolean().parse(args[0])
    const settings = services.appSettings.get()
    if (enabled) {
      if (settings.cursorStyle === 'system') {
        throw new Error('Choose a custom cursor pack first.')
      }
      services.systemCursor.apply(settings.cursorStyle)
    } else {
      services.systemCursor.restore()
    }
    await services.appSettings.setCursorSystemWide(enabled)
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsGetPreviewStats, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.widgetApi.getPreviewStats()
  })

  ipcMain.handle(IPC.settingsSetHotkey, async (event, ...args) => {
    assertSettingsSender(event)
    const accelerator = acceleratorSchema.parse(args[0])
    const result = services.hotkeys.register(accelerator)
    if (!result.ok) {
      throw new Error(result.error ?? 'The shortcut could not be registered.')
    }
    await services.appSettings.setHotkey(accelerator)
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsSetLoginItem, async (event, ...args) => {
    assertSettingsSender(event)
    const enabled = z.boolean().parse(args[0])
    if (!app.isPackaged) {
      throw new Error('Start with Windows is only available in an installed build.')
    }
    app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsResetLayout, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    await services.layout.resetLayout()
    return true
  })

  ipcMain.handle(IPC.settingsOpenDataFolder, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    const error = await shell.openPath(app.getPath('userData'))
    if (error) {
      throw new Error(error)
    }
  })

  ipcMain.handle(IPC.settingsExportDiagnostics, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return exportDiagnostics()
  })

  ipcMain.handle(IPC.settingsStartNormally, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    await services.startup.resetForStartNormally()
    const argsWithoutSafe = process.argv.slice(1).filter((argument) => argument !== '--safe')
    app.relaunch({ args: argsWithoutSafe })
    app.exit(0)
  })

  ipcMain.handle(IPC.settingsCompleteOnboarding, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    await services.appSettings.completeOnboarding()
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsGetLicenses, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return readLicenses()
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

  ipcMain.handle(IPC.getWidgetRuntime, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    const metrics = new Map(app.getAppMetrics().map((metric) => [metric.pid, metric]))
    return services.layout.getRuntimeSnapshots().map((snapshot) => {
      const metric = snapshot.processId ? metrics.get(snapshot.processId) : undefined
      return {
        ...snapshot,
        cpuPercent: metric?.cpu.percentCPUUsage ?? 0,
        memoryMB: metric ? metric.memory.workingSetSize / 1024 : 0
      }
    })
  })

  ipcMain.handle(IPC.getSavedAiWidgets, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.widgetService.listSavedAiWidgets()
  })

  ipcMain.handle(IPC.wallpaperGetState, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.wallpaper.getState()
  })

  ipcMain.handle(IPC.wallpaperAddFiles, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    const window = getSettingsWindow()
    if (!window) {
      throw new Error('Settings window is not available')
    }
    const result = await dialog.showOpenDialog(window, {
      title: t('dialog.addWallpapers'),
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: t('dialog.imagesAndVideos'),
          extensions: ['jpg', 'jpeg', 'png', 'bmp', 'mp4', 'webm']
        },
        { name: t('dialog.images'), extensions: ['jpg', 'jpeg', 'png', 'bmp'] },
        { name: t('dialog.videos'), extensions: ['mp4', 'webm'] }
      ]
    })
    if (result.canceled) {
      return services.wallpaper.getState()
    }
    return services.wallpaper.addFiles(result.filePaths)
  })

  ipcMain.handle(IPC.wallpaperAddFolder, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    const window = getSettingsWindow()
    if (!window) {
      throw new Error('Settings window is not available')
    }
    const result = await dialog.showOpenDialog(window, {
      title: t('dialog.addHtmlFolder'),
      properties: ['openDirectory'],
      buttonLabel: t('dialog.addFolder')
    })
    const folder = result.filePaths[0]
    if (result.canceled || !folder) {
      return services.wallpaper.getState()
    }
    return services.wallpaper.addHtmlFolder(folder)
  })

  ipcMain.handle(IPC.wallpaperRemove, async (event, ...args) => {
    assertSettingsSender(event)
    const id = wallpaperIdSchema.parse(args[0])
    return services.wallpaper.remove(id)
  })

  ipcMain.handle(IPC.wallpaperSet, async (event, ...args) => {
    assertSettingsSender(event)
    const id = wallpaperIdSchema.parse(args[0])
    const fit = wallpaperFitSchema.parse(args[1])
    return services.wallpaper.setStatic(id, fit)
  })

  ipcMain.handle(IPC.wallpaperSetLive, async (event, ...args) => {
    assertSettingsSender(event)
    const id = wallpaperIdSchema.parse(args[0])
    const fit = wallpaperFitSchema.parse(args[1])
    return services.wallpaper.setLive(id, fit)
  })

  ipcMain.handle(IPC.wallpaperSetInteractive, async (event, ...args) => {
    assertSettingsSender(event)
    const id = wallpaperIdSchema.parse(args[0])
    const interactive = z.boolean().parse(args[1])
    return services.wallpaper.setInteractive(id, interactive)
  })

  ipcMain.handle(IPC.wallpaperSetLiveOptions, async (event, ...args) => {
    assertSettingsSender(event)
    const options = wallpaperLiveOptionsSchema.parse(args[0])
    return services.wallpaper.setLiveOptions(options)
  })

  ipcMain.handle(IPC.wallpaperSlideshow, async (event, ...args) => {
    assertSettingsSender(event)
    const settings = wallpaperSlideshowSchema.parse(args[0])
    return services.wallpaper.setSlideshow(settings)
  })

  ipcMain.handle(IPC.wallpaperRestore, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.wallpaper.restoreOriginal()
  })

  ipcMain.handle(IPC.addWidget, async (event, ...args) => {
    assertSettingsSender(event)
    const builtinType = builtinTypeSchema.parse(args[0])
    const variant = args[1] === undefined ? undefined : widgetVariantSchema.parse(args[1])
    return services.layout.addWidget(builtinType, variant)
  })

  ipcMain.handle(IPC.addAiWidgetCopy, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    return services.layout.addAiWidgetCopy(widgetId)
  })

  ipcMain.handle(IPC.duplicateWidget, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    return services.layout.duplicateWidget(widgetId)
  })

  ipcMain.handle(IPC.setWidgetEnabled, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const enabled = z.boolean().parse(args[1])
    return services.layout.setWidgetEnabled(widgetId, enabled)
  })

  ipcMain.handle(IPC.setWidgetLocked, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const locked = z.boolean().parse(args[1])
    return services.layout.setLocked(widgetId, locked)
  })

  ipcMain.handle(IPC.setWidgetOpacity, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const opacity = z.number().min(0.1).max(1).parse(args[1])
    return services.layout.setOpacity(widgetId, opacity)
  })

  ipcMain.handle(IPC.setWidgetVariant, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const variant = widgetVariantSchema.parse(args[1])
    return services.layout.setWidgetVariant(widgetId, variant)
  })

  ipcMain.handle(IPC.reloadWidget, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    services.layout.reloadWidget(widgetId)
  })

  ipcMain.handle(IPC.removeWidget, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const removed = await services.layout.removeWidget(widgetId, getSettingsWindow())
    if (removed) {
      services.popover.closeForWidget(widgetId)
    }
    return removed
  })

  ipcMain.handle(IPC.deleteAiWidget, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    return services.layout.deleteAiWidget(widgetId, getSettingsWindow())
  })

  ipcMain.handle(IPC.appsGetState, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return appsAndBundlesState(services)
  })

  ipcMain.handle(IPC.appsRefresh, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    await services.scanner.refresh()
    return appsAndBundlesState(services)
  })

  ipcMain.handle(IPC.setWidgetPermission, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const permission = permissionSchema.parse(args[1])
    const granted = z.boolean().parse(args[2])
    const summary = await services.widgetService.setGrantedPermission(widgetId, permission, granted)
    services.layout.notifyChanged()
    return summary
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

  ipcMain.on(IPC.shellEditWithAi, (event) => {
    try {
      const widgetId = shellWidgetId(services, event)
      showSettingsWindow({ editWidgetId: widgetId })
    } catch (error) {
      log.warn('Rejected shell edit with AI', error)
    }
  })

  ipcMain.on(IPC.shellRemove, (event) => {
    try {
      const widgetId = shellWidgetId(services, event)
      services.popover.closeForWidget(widgetId)
      void services.layout.removeWidgetForSender(event.sender)
    } catch (error) {
      log.warn('Rejected shell remove', error)
    }
  })

  ipcMain.on(IPC.shellWidgetUnresponsive, (event) => {
    try {
      services.layout.reportWidgetUnresponsive(shellWidgetId(services, event))
    } catch (error) {
      log.warn('Rejected widget unresponsive report', error)
    }
  })

  ipcMain.on(IPC.shellWidgetResponsive, (event) => {
    try {
      services.layout.reportWidgetResponsive(shellWidgetId(services, event))
    } catch (error) {
      log.warn('Rejected widget responsive report', error)
    }
  })

  ipcMain.handle(IPC.aiGetConfig, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.ai.getConfig()
  })

  ipcMain.handle(IPC.aiSaveSettings, async (event, ...args) => {
    assertSettingsSender(event)
    const settings = aiSettingsSchema.parse(args[0])
    return services.ai.saveSettings(settings)
  })

  ipcMain.handle(IPC.aiSaveKey, async (event, ...args) => {
    assertSettingsSender(event)
    const provider = aiProviderSchema.parse(args[0])
    const key = aiKeySchema.parse(args[1])
    return services.ai.saveKey(provider, key)
  })

  ipcMain.handle(IPC.aiRemoveKey, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.ai.removeKey()
  })

  ipcMain.handle(IPC.aiListModels, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.ai.listModels()
  })

  ipcMain.handle(IPC.aiTestConnection, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.ai.testConnection()
  })

  ipcMain.handle(IPC.aiGenerate, async (event, ...args) => {
    assertSettingsSender(event)
    const prompt = aiPromptSchema.parse(args[0])
    return services.ai.generateWidget(prompt)
  })

  ipcMain.handle(IPC.aiRevise, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const instruction = aiInstructionSchema.parse(args[1])
    return services.ai.reviseWidget(widgetId, instruction)
  })

  ipcMain.handle(IPC.aiCancel, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.ai.cancel()
  })

  ipcMain.handle(IPC.aiRepair, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.ai.repair()
  })

  ipcMain.handle(IPC.aiGetPreviewLogs, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.ai.getPreviewLogs()
  })

  ipcMain.handle(IPC.aiClosePreview, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.ai.closePreview()
  })

  ipcMain.handle(IPC.aiApproveSave, async (event, ...args) => {
    assertSettingsSender(event)
    const approval = aiApprovalSchema.parse(args[0])
    return services.ai.savePreview(approval)
  })

  ipcMain.handle(IPC.aiGetWidgetSource, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    return services.ai.getWidgetSource(widgetId)
  })

  ipcMain.handle(IPC.aiUndoWidget, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    return services.ai.undoWidget(widgetId)
  })

  ipcMain.handle(IPC.openExternal, async (event, ...args) => {
    assertSettingsSender(event)
    const raw = z.string().max(2000).parse(args[0])
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw new Error('Invalid URL')
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Only public https:// links can be opened')
    }
    await shell.openExternal(url.toString())
  })

  ipcMain.handle(IPC.widgetApi, (event, ...args) => {
    return services.widgetApi.handle(event.sender, args[0])
  })

  ipcMain.on(IPC.badgeAction, (event, ...args) => {
    try {
      services.layout.handleBadgeAction(event.sender, args[0])
    } catch (error) {
      log.warn('Rejected badge action', error)
    }
  })

  ipcMain.handle(IPC.bundleGetState, (event) => {
    return services.popover.stateForSender(event.sender)
  })

  ipcMain.handle(IPC.bundleRename, (event, ...args) => {
    const name = bundleNameSchema.parse(args[0])
    return services.popover.renameForSender(event.sender, name)
  })

  ipcMain.handle(IPC.bundleRemoveApp, (event, ...args) => {
    const appId = appIdSchema.parse(args[0])
    return services.popover.removeAppForSender(event.sender, appId)
  })

  ipcMain.handle(IPC.bundleReorder, (event, ...args) => {
    const from = gridIndexSchema.parse(args[0])
    const to = gridIndexSchema.parse(args[1])
    return services.popover.reorderForSender(event.sender, from, to)
  })

  ipcMain.handle(IPC.bundleLaunch, async (event, ...args) => {
    const appId = appIdSchema.parse(args[0])
    await services.popover.launchForSender(event.sender, appId)
  })

  ipcMain.on(IPC.bundleClose, (event) => {
    services.popover.closeForSender(event.sender)
  })
}
