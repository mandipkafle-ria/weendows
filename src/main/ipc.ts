import {
  app,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { z } from 'zod'
import { resolveTheme, resolveWidgetAppearance } from '../shared/appearance'
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
  bundleIdSchema,
  bundleNameSchema,
  cursorConfigPatchSchema,
  cursorStyleSchema,
  gridIndexSchema,
  noArgsSchema,
  permissionSchema,
  taskbarAnchorSchema,
  taskbarSettingsPatchSchema,
  themeSourceSchema,
  wallpaperFitSchema,
  wallpaperIdSchema,
  wallpaperLiveOptionsSchema,
  wallpaperSlideshowSchema,
  widgetAppearancePatchSchema,
  widgetBoundsPatchSchema,
  widgetIdSchema,
  widgetVariantSchema
} from '../shared/schemas'
import type {
  AppsAndBundlesState,
  GeneralState,
  SafeModeReason,
  WidgetAppearance
} from '../shared/types'
import { SYSTEM_CURSOR_STYLES } from '../shared/types'
import { t } from './i18n'
import { getEditMode, setEditMode } from './services/edit-mode'
import { runNativeSmokeTest } from './native/win32'
import type { SystemCursorService } from './native/system-cursor'
import log from './services/logger'
import type { AiService } from './services/ai-service'
import type { AppGridService } from './services/app-grid-service'
import type { AppScanner } from './services/app-scanner'
import { cursorConfigFromSettings, type AppSettingsService } from './services/app-settings'
import { exportDiagnostics } from './services/diagnostics'
import type { HotkeyService } from './hotkeys'
import { readLicenses } from './services/licenses'
import type { NoticeService } from './services/notices'
import type { StartupService } from './services/startup'
import type { TaskbarService } from './services/taskbar'
import type { WallpaperService } from './services/wallpaper-service'
import type { WidgetApiService } from './services/widget-api'
import type { WidgetService } from './services/widget-service'
import type { WidgetPreviewAppearanceService } from './services/widget-preview-appearance'
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
  previewAppearances: WidgetPreviewAppearanceService
  startup: StartupService
  hotkeys: HotkeyService
  scanner: AppScanner
  appGrid: AppGridService
  taskbar: TaskbarService
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
    resolvedTheme: resolveTheme(settings.theme, nativeTheme.shouldUseDarkColors),
    widgetDefaultTheme: settings.widgetDefaultTheme,
    resolvedWidgetTheme: resolveTheme(settings.widgetDefaultTheme, nativeTheme.shouldUseDarkColors),
    accent: settings.accent,
    cursor: cursorConfigFromSettings(settings),
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
  const summaries = services.layout.getSummaries()
  const gridWidgets = summaries
    .filter((summary) => summary.manifest.builtinType === 'app-grid')
    .map((summary) => ({
      widgetId: summary.manifest.id,
      title: services.appGrid.gridTitle(summary.manifest.id),
      enabled: summary.placement.enabled
    }))

  const state: AppsAndBundlesState = {
    apps,
    hiddenCount: apps.filter((entry) => entry.hidden).length,
    bundles: services.appGrid.listBundles(),
    scanning: services.scanner.isScanning(),
    lastScanAt: services.scanner.lastScanTime(),
    gridWidgets
  }
  services.taskbar.notifyChanged()
  return state
}

function isSettingsSender(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  const settingsWindow = getSettingsWindow()
  return (
    !!settingsWindow && !settingsWindow.isDestroyed() && event.sender === settingsWindow.webContents
  )
}

function assertSettingsSender(event: IpcMainInvokeEvent): void {
  if (!isSettingsSender(event)) {
    throw new Error('Unexpected IPC sender')
  }
}

function assertTaskbarSender(services: IpcServices, event: IpcMainInvokeEvent): void {
  if (!services.taskbar.isSender(event.sender)) {
    throw new Error('Unexpected taskbar IPC sender')
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
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsSetWidgetDefaultTheme, async (event, ...args) => {
    assertSettingsSender(event)
    const theme = themeSourceSchema.parse(args[0])
    await services.appSettings.setWidgetDefaultTheme(theme)
    services.layout.broadcastState()
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
      if (!(SYSTEM_CURSOR_STYLES as readonly string[]).includes(cursorStyle)) {
        throw new Error('This cursor style is available inside HomeLayer only.')
      }
      services.systemCursor.apply(cursorStyle)
      if (cursorStyle === 'system') {
        await services.appSettings.setCursorSystemWide(false)
      }
    }
    await services.appSettings.setCursorStyle(cursorStyle)
    services.layout.broadcastState()
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsSetCursor, async (event, ...args) => {
    assertSettingsSender(event)
    const patch = cursorConfigPatchSchema.parse(args[0])
    const settings = services.appSettings.get()
    const nextStyle = patch.style ?? settings.cursorStyle
    const nextSystemWide = patch.systemWide ?? settings.cursorSystemWide

    if (nextSystemWide) {
      if (
        nextStyle === 'system' ||
        !(SYSTEM_CURSOR_STYLES as readonly string[]).includes(nextStyle)
      ) {
        throw new Error('This cursor style is available inside HomeLayer only.')
      }
      services.systemCursor.apply(nextStyle)
    } else if (settings.cursorSystemWide) {
      services.systemCursor.restore()
    }

    const appearance = { ...patch }
    delete appearance.systemWide
    if (Object.keys(appearance).length > 0) {
      await services.appSettings.setCursorAppearance(appearance)
    }
    if (patch.systemWide !== undefined) {
      await services.appSettings.setCursorSystemWide(patch.systemWide)
    }
    services.layout.broadcastState()
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsSetCursorSystemWide, async (event, ...args) => {
    assertSettingsSender(event)
    const enabled = z.boolean().parse(args[0])
    const settings = services.appSettings.get()
    if (enabled) {
      if (
        settings.cursorStyle === 'system' ||
        !(SYSTEM_CURSOR_STYLES as readonly string[]).includes(settings.cursorStyle)
      ) {
        throw new Error('Choose a system-wide cursor pack first.')
      }
      services.systemCursor.apply(settings.cursorStyle)
    } else {
      services.systemCursor.restore()
    }
    await services.appSettings.setCursorSystemWide(enabled)
    services.layout.broadcastState()
    return generalState(services)
  })

  ipcMain.handle(IPC.settingsCreateWidgetPreview, (event, ...args) => {
    assertSettingsSender(event)
    const parsed = widgetAppearancePatchSchema.parse(args[0])
    const theme = z.enum(['dark', 'light']).parse(args[1])
    const assetWidgetId = widgetIdSchema.optional().parse(args[2])
    return services.previewAppearances.create(resolveWidgetAppearance(parsed), theme, assetWidgetId)
  })

  ipcMain.handle(IPC.settingsReleaseWidgetPreview, (event, ...args) => {
    assertSettingsSender(event)
    const token = z.string().min(1).max(64).parse(args[0])
    services.previewAppearances.release(token)
  })

  ipcMain.handle(IPC.settingsPickWidgetBackground, async (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    const window = getSettingsWindow()
    if (!window) {
      throw new Error('Settings window is not available')
    }
    const result = await dialog.showOpenDialog(window, {
      title: t('dialog.chooseWidgetBackground'),
      properties: ['openFile'],
      filters: [{ name: t('dialog.images'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    })
    const file = result.filePaths[0]
    if (result.canceled || !file) {
      return null
    }
    const buffer = await readFile(file)
    if (buffer.byteLength > 20 * 1024 * 1024) {
      throw new Error('Background image is larger than 20 MB.')
    }
    const extension = extname(file).toLowerCase()
    const mime =
      extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : extension === '.webp'
          ? 'image/webp'
          : extension === '.gif'
            ? 'image/gif'
            : 'image/png'
    return {
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
      name: file.split(/[\\/]/).pop() ?? file
    }
  })

  ipcMain.handle(IPC.settingsGetWidgetBackground, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const placement = services.widgetService.getPlacement(widgetId)
    if (!placement?.bgImage) {
      return null
    }
    return services.widgetService.readBackgroundDataUrl(widgetId, placement.bgImage)
  })

  ipcMain.handle(IPC.settingsSetWidgetAppearance, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const appearance = widgetAppearancePatchSchema.parse(args[1]) as Partial<WidgetAppearance>
    return services.layout.setWidgetAppearance(widgetId, appearance)
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

  ipcMain.handle(IPC.getDisplays, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    return services.layout.listDisplays()
  })

  ipcMain.handle(IPC.setWidgetBounds, (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const bounds = widgetBoundsPatchSchema.parse(args[1])
    return services.layout.setWidgetBounds(widgetId, bounds)
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
    const appearance =
      args[2] === undefined
        ? undefined
        : (widgetAppearancePatchSchema.parse(args[2]) as Partial<WidgetAppearance>)
    return services.layout.addWidget(builtinType, variant, appearance)
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
    const confirmed = z.boolean().optional().parse(args[1]) ?? false
    const removed = await services.layout.removeWidget(widgetId, getSettingsWindow(), confirmed)
    if (removed) {
      services.popover.closeForWidget(widgetId)
    }
    return removed
  })

  ipcMain.handle(IPC.deleteAiWidget, async (event, ...args) => {
    assertSettingsSender(event)
    const widgetId = widgetIdSchema.parse(args[0])
    const confirmed = z.boolean().optional().parse(args[1]) ?? false
    return services.layout.deleteAiWidget(widgetId, getSettingsWindow(), confirmed)
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

  ipcMain.handle(IPC.taskbarGetState, (event, ...args) => {
    if (!isSettingsSender(event) && !services.taskbar.isSender(event.sender)) {
      throw new Error('Unexpected IPC sender')
    }
    assertNoArgs(args)
    return services.taskbar.state()
  })

  ipcMain.handle(IPC.taskbarUpdate, (event, ...args) => {
    assertSettingsSender(event)
    const patch = taskbarSettingsPatchSchema.parse(args[0])
    return services.taskbar.update(patch)
  })

  ipcMain.handle(IPC.taskbarLaunchApp, async (event, ...args) => {
    assertTaskbarSender(services, event)
    const appId = appIdSchema.parse(args[0])
    await services.taskbar.launchApp(appId)
  })

  ipcMain.handle(IPC.taskbarOpenBundle, async (event, ...args) => {
    assertTaskbarSender(services, event)
    const bundleId = bundleIdSchema.parse(args[0])
    const anchor = taskbarAnchorSchema.parse(args[1])
    await services.taskbar.openBundle(bundleId, anchor)
  })

  ipcMain.handle(IPC.taskbarOpenSettings, (event, ...args) => {
    assertTaskbarSender(services, event)
    assertNoArgs(args)
    showSettingsWindow()
  })

  ipcMain.handle(IPC.appAddToHomescreen, async (event, ...args) => {
    assertSettingsSender(event)
    const appId = z.string().min(1).parse(args[0])
    const chosenWidgetId = z.string().optional().parse(args[1])

    let widgetId: string
    if (chosenWidgetId === '__new__') {
      const newWidget = await services.layout.addWidget('app-grid')
      widgetId = newWidget.manifest.id
    } else if (chosenWidgetId) {
      widgetId = chosenWidgetId
    } else {
      const summaries = services.layout.getSummaries()
      let appGridWidget = summaries.find(
        (summary) => summary.manifest.builtinType === 'app-grid' && summary.placement.enabled
      )
      if (!appGridWidget) {
        appGridWidget = await services.layout.addWidget('app-grid')
      }
      widgetId = appGridWidget.manifest.id
    }

    services.appGrid.addApps(widgetId, [appId])
    services.layout.reloadWidget(widgetId)
    return { success: true, widgetId }
  })

  ipcMain.handle(IPC.bundleCreate, async (event, ...args) => {
    assertSettingsSender(event)
    const name = z.string().trim().min(1).max(24).parse(args[0])
    const appIds = z.array(z.string().min(1)).min(1).parse(args[1])
    const targetParam = args[2]

    let widgetId = 'default'
    let addToGrid = true
    if (typeof targetParam === 'boolean') {
      addToGrid = targetParam
    } else if (typeof targetParam === 'string') {
      if (targetParam === 'none') {
        addToGrid = false
      } else if (targetParam === '__new__') {
        const newWidget = await services.layout.addWidget('app-grid')
        widgetId = newWidget.manifest.id
      } else {
        widgetId = targetParam
      }
    }

    if (addToGrid && widgetId === 'default') {
      const summaries = services.layout.getSummaries()
      let appGridWidget = summaries.find(
        (summary) => summary.manifest.builtinType === 'app-grid' && summary.placement.enabled
      )
      if (!appGridWidget) {
        appGridWidget = await services.layout.addWidget('app-grid')
      }
      widgetId = appGridWidget.manifest.id
    }

    services.appGrid.createBundle(widgetId, name, appIds)
    if (addToGrid && widgetId !== 'default') {
      services.layout.reloadWidget(widgetId)
    }
    return appsAndBundlesState(services)
  })

  ipcMain.handle(IPC.bundleAddToHomescreen, async (event, ...args) => {
    assertSettingsSender(event)
    const bundleId = z.string().min(1).parse(args[0])
    const chosenWidgetId = z.string().optional().parse(args[1])

    let widgetId: string
    if (chosenWidgetId === '__new__') {
      const newWidget = await services.layout.addWidget('app-grid')
      widgetId = newWidget.manifest.id
    } else if (chosenWidgetId) {
      widgetId = chosenWidgetId
    } else {
      const summaries = services.layout.getSummaries()
      let appGridWidget = summaries.find(
        (summary) => summary.manifest.builtinType === 'app-grid' && summary.placement.enabled
      )
      if (!appGridWidget) {
        appGridWidget = await services.layout.addWidget('app-grid')
      }
      widgetId = appGridWidget.manifest.id
    }

    services.appGrid.addBundleToGrid(widgetId, bundleId)
    services.layout.reloadWidget(widgetId)
    return { success: true, widgetId }
  })

  ipcMain.handle(IPC.bundleDelete, async (event, ...args) => {
    assertSettingsSender(event)
    const bundleId = z.string().min(1).parse(args[0])
    services.appGrid.deleteBundle(bundleId)
    const summaries = services.layout.getSummaries()
    for (const summary of summaries) {
      if (summary.manifest.builtinType === 'app-grid') {
        services.layout.reloadWidget(summary.manifest.id)
      }
    }
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

  ipcMain.handle(IPC.dismissNotice, (event, ...args) => {
    assertSettingsSender(event)
    const noticeId = z.string().min(1).max(64).parse(args[0])
    services.notices.remove(noticeId)
  })

  ipcMain.handle(IPC.clearNotices, (event, ...args) => {
    assertSettingsSender(event)
    assertNoArgs(args)
    services.notices.clear()
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
