import { app, nativeImage, nativeTheme, shell } from 'electron'
import { basename, join } from 'node:path'
import { BUILTIN_WIDGETS } from '../shared/builtins'
import { APP_ID, LAYOUT_WRITE_DEBOUNCE_MS } from '../shared/constants'
import { IPC } from '../shared/ipc'
import {
  appGridFileSchema,
  appGroupsFileSchema,
  layoutFileSchema,
  wallpaperFileSchema
} from '../shared/schemas'
import type {
  AppEntry,
  AppGridFile,
  AppGroupsFile,
  LayoutFile,
  SafeModeReason,
  WallpaperFile
} from '../shared/types'
import { HotkeyService } from './hotkeys'
import { registerIpcHandlers } from './ipc'
import { resolveWallpaperStrategy } from './native/wallpaper-attach'
import { SystemCursorService } from './native/system-cursor'
import { parseAppFlags } from './lifecycle'
import {
  readCurrentWallpaperFit,
  readCurrentWallpaperPath,
  setWallpaper,
  setWallpaperPath
} from './native/wallpaper-native'
import { registerIconProtocol } from './protocol/icon-protocol'
import { registerWallpaperProtocol } from './protocol/wallpaper-protocol'
import { registerWidgetProtocol, registerWidgetScheme } from './protocol/widget-protocol'
import { AiConfigService } from './services/ai-config'
import { AiService } from './services/ai-service'
import { AppGridService } from './services/app-grid-service'
import { AppLauncher, launchScannedApp } from './services/app-launcher'
import { AppScanner } from './services/app-scanner'
import { AppSettingsService } from './services/app-settings'
import { getEditMode, onEditModeChanged, setEditMode, toggleEditMode } from './services/edit-mode'
import { SecretsService } from './services/secrets'
import { discoverSteamRoots } from './services/steam-scanner'
import log, { initLogger, logStartup } from './services/logger'
import { MetricsLogger } from './services/metrics-logger'
import { NetProxy } from './services/net-proxy'
import { NoticeService } from './services/notices'
import { StartupService } from './services/startup'
import { JsonStore } from './services/store'
import { SystemStatsSampler } from './services/system-stats'
import { defaultWallpaperFile, WallpaperService } from './services/wallpaper-service'
import { WallpaperLiveService } from './services/wallpaper-live'
import { WallpaperThumbnails } from './services/wallpaper-thumbnails'
import { WidgetApiService } from './services/widget-api'
import { WidgetLogService } from './services/widget-logs'
import { WidgetService } from './services/widget-service'
import { configureWidgetSession } from './services/widget-session'
import { WidgetStorageService } from './services/widget-storage'
import { createTray, type TrayController } from './tray'
import { LayoutService } from './windows/layout'
import { BundlePopoverService } from './windows/popover-window'
import {
  configureSettingsWindowSize,
  getSettingsWindow,
  onSettingsWindowClosed,
  showSettingsWindow
} from './windows/settings-window'

const flags = parseAppFlags(process.argv)
const hasLock = app.requestSingleInstanceLock()

let tray: TrayController | null = null
let layout: LayoutService | null = null
let widgetService: WidgetService | null = null
let systemStats: SystemStatsSampler | null = null
let aiService: AiService | null = null
let appScanner: AppScanner | null = null
let appGrid: AppGridService | null = null
let popover: BundlePopoverService | null = null
let wallpaper: WallpaperService | null = null
let wallpaperLive: WallpaperLiveService | null = null
let appSettings: AppSettingsService | null = null
let systemCursor: SystemCursorService | null = null
let startup: StartupService | null = null
let hotkeys: HotkeyService | null = null
let metricsLogger: MetricsLogger | null = null
let effectiveSafe = flags.safe
let safeModeReason: SafeModeReason = flags.safe ? 'flag' : null
let shuttingDown = false

registerWidgetScheme()

if (!hasLock) {
  app.quit()
} else {
  let shouldShowSettings = !flags.hidden

  app.setAppUserModelId(APP_ID)

  app.on('second-instance', () => {
    shouldShowSettings = true
    if (app.isReady()) {
      showSettingsWindow()
    }
  })

  app.on('window-all-closed', () => {
    log.debug('All windows closed; staying in the tray')
  })

  app.on('will-quit', () => {
    hotkeys?.stop()
  })

  app.on('before-quit', (event) => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    event.preventDefault()

    tray?.destroy()
    tray = null
    hotkeys?.stop()
    metricsLogger?.stop()
    startup?.stop()
    systemStats?.stop()
    appScanner?.stop()
    popover?.close()
    void aiService?.cancel()
    layout?.stop()
    wallpaperLive?.stop()
    wallpaperLive = null
    wallpaper?.stop()
    try {
      systemCursor?.restore()
    } catch (error) {
      log.warn('Could not restore the Windows cursor', error)
    }

    const flush = Promise.all([
      widgetService ? widgetService.flush() : Promise.resolve(),
      appGrid ? appGrid.flush() : Promise.resolve(),
      wallpaper ? wallpaper.flush() : Promise.resolve(),
      appSettings ? appSettings.flush() : Promise.resolve()
    ])
    void flush
      .catch((error: unknown) => {
        log.error('Failed to flush layout', error)
      })
      .finally(() => {
        app.quit()
      })
  })

  app
    .whenReady()
    .then(async () => {
      initLogger()
      logStartup(flags)

      process.on('uncaughtException', (error) => {
        log.error('Uncaught main-process exception', error)
      })
      process.on('unhandledRejection', (reason) => {
        log.error('Unhandled main-process rejection', reason)
      })
      app.on('render-process-gone', (_event, webContents, details) => {
        log.error('Renderer process gone', {
          id: webContents.id,
          url: webContents.getURL(),
          ...details
        })
      })
      app.on('child-process-gone', (_event, details) => {
        log.error('Child process gone', details)
      })

      const userDataDir = app.getPath('userData')
      const settingsService = new AppSettingsService(join(userDataDir, 'settings.json'))
      appSettings = settingsService
      await settingsService.load()
      nativeTheme.themeSource = settingsService.get().theme
      configureSettingsWindowSize(
        () => settingsService.get().window,
        (width, height) => settingsService.setWindowSize(width, height)
      )

      const cursorService = new SystemCursorService({
        cursorDir: app.isPackaged
          ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'cursors')
          : join(app.getAppPath(), 'resources', 'cursors')
      })
      systemCursor = cursorService
      try {
        cursorService.sync(
          settingsService.get().cursorStyle,
          settingsService.get().cursorSystemWide
        )
      } catch (error) {
        log.warn('Could not apply the Windows cursor on startup', error)
      }

      const startupService = new StartupService(join(userDataDir, 'startup.json'))
      startup = startupService
      const startupEvaluation = await startupService.begin(flags.safe)
      effectiveSafe = startupEvaluation.safe
      safeModeReason = startupEvaluation.reason
      if (startupEvaluation.reason === 'crashes') {
        shouldShowSettings = true
      }
      startupService.startCleanTimer()
      startupService.scheduleForcedCrash(effectiveSafe)

      const notices = new NoticeService()
      const widgetsDir = join(userDataDir, 'widgets')
      const wallpapersDir = join(userDataDir, 'wallpapers')
      const builtinsDir = join(app.getAppPath(), 'resources', 'builtin-widgets')
      const aiConfig = new AiConfigService(join(userDataDir, 'ai-settings.json'))
      const secrets = new SecretsService(join(userDataDir, 'secrets.json'))
      await Promise.all([aiConfig.load(), secrets.load()])
      const layoutStore = new JsonStore<LayoutFile>({
        file: join(app.getPath('userData'), 'layout.json'),
        schema: layoutFileSchema,
        defaults: () => ({ schema: 1, placements: [] }),
        debounceMs: LAYOUT_WRITE_DEBOUNCE_MS,
        onCorrupt: (error, backupPath) => {
          notices.add(
            'warning',
            `layout.json could not be read (${error.message}). A backup was saved as ${basename(backupPath)} and the layout was reset.`
          )
        },
        onWriteError: (error) => {
          log.error('Layout write failed', error)
        }
      })

      const service = new WidgetService({
        widgetsDir,
        builtinsDir,
        layout: layoutStore,
        notices
      })
      widgetService = service
      await service.load()

      const layoutService = new LayoutService({
        widgetService: service,
        notices,
        safe: effectiveSafe,
        cursorStyle: () => settingsService.get().cursorStyle
      })
      layout = layoutService

      configureWidgetSession()

      const wallpaperStore = new JsonStore<WallpaperFile>({
        file: join(userDataDir, 'wallpapers.json'),
        schema: wallpaperFileSchema,
        defaults: defaultWallpaperFile,
        debounceMs: LAYOUT_WRITE_DEBOUNCE_MS,
        onCorrupt: (error, backupPath) => {
          notices.add(
            'warning',
            `wallpapers.json could not be read (${error.message}). A backup was saved as ${basename(backupPath)} and the wallpaper library was reset.`
          )
        },
        onWriteError: (error) => {
          log.error('Wallpaper library write failed', error)
        }
      })
      const wallpaperService = new WallpaperService({
        store: wallpaperStore,
        wallpapersDir,
        thumbsDir: join(wallpapersDir, 'thumbs'),
        native: {
          readCurrentWallpaperPath,
          readCurrentWallpaperFit,
          setWallpaper,
          setWallpaperPath
        },
        thumbnails: new WallpaperThumbnails(join(wallpapersDir, 'thumbs')),
        notices,
        safe: effectiveSafe
      })
      wallpaper = wallpaperService
      await wallpaperService.load()

      const scanner = new AppScanner({
        roots: [
          join(
            process.env['ProgramData'] ?? 'C:/ProgramData',
            'Microsoft',
            'Windows',
            'Start Menu',
            'Programs'
          ),
          join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        ],
        iconsDir: join(userDataDir, 'cache', 'icons'),
        readShortcut: (shortcutPath) => shell.readShortcutLink(shortcutPath),
        getFileIcon: (shortcutPath) => app.getFileIcon(shortcutPath, { size: 'large' }),
        createImage: (imagePath) => nativeImage.createFromPath(imagePath),
        steamRoots: discoverSteamRoots
      })
      appScanner = scanner

      const gridsStore = new JsonStore<AppGridFile>({
        file: join(userDataDir, 'grids.json'),
        schema: appGridFileSchema,
        defaults: () => ({ schema: 1, grids: {} }),
        debounceMs: LAYOUT_WRITE_DEBOUNCE_MS,
        onCorrupt: (error, backupPath) => {
          notices.add(
            'warning',
            `grids.json could not be read (${error.message}). A backup was saved as ${basename(backupPath)} and the app grid was reset.`
          )
        },
        onWriteError: (error) => {
          log.error('App grid write failed', error)
        }
      })
      const groupsStore = new JsonStore<AppGroupsFile>({
        file: join(userDataDir, 'groups.json'),
        schema: appGroupsFileSchema,
        defaults: () => ({ schema: 1, bundles: [] }),
        debounceMs: LAYOUT_WRITE_DEBOUNCE_MS,
        onCorrupt: (error, backupPath) => {
          notices.add(
            'warning',
            `groups.json could not be read (${error.message}). A backup was saved as ${basename(backupPath)} and bundles were reset.`
          )
        },
        onWriteError: (error) => {
          log.error('Bundle write failed', error)
        }
      })
      const grid = new AppGridService({
        grids: gridsStore,
        groups: groupsStore,
        scanner
      })
      appGrid = grid
      await grid.load()

      const launcher = new AppLauncher()
      const syncApps = (apps: AppEntry[]): void => {
        const scanned = scanner.scanned()
        launcher.setApps(
          scanned.map((entry) => ({
            id: entry.id,
            name: entry.name,
            launch: () => launchScannedApp(entry)
          }))
        )
        layoutService.broadcastWidgetEvent('apps', apps)
      }
      scanner.onChange(syncApps)
      void scanner.refresh().catch((error: unknown) => log.error('Initial app scan failed', error))
      scanner.startWatching()

      const bundlePopover = new BundlePopoverService({
        appGrid: grid,
        launcher,
        onChanged: () => layoutService.broadcastWidgetEvent('apps', scanner.list())
      })
      popover = bundlePopover

      const stats = new SystemStatsSampler()
      systemStats = stats
      const widgetApi = new WidgetApiService({
        layout: layoutService,
        widgetService: service,
        storage: new WidgetStorageService(widgetsDir),
        stats,
        net: new NetProxy(`HomeLayer/${app.getVersion()}`),
        launcher,
        appScanner: scanner,
        appGrid: grid,
        popover: bundlePopover,
        logs: new WidgetLogService()
      })
      const ai = new AiService({
        config: aiConfig,
        secrets,
        widgetService: service,
        widgetApi,
        layout: layoutService
      })
      aiService = ai

      const hotkeyService = new HotkeyService(() => {
        setEditMode(!getEditMode())
      })
      hotkeys = hotkeyService

      registerIpcHandlers({
        widgetService: service,
        widgetApi,
        layout: layoutService,
        notices,
        ai,
        popover: bundlePopover,
        wallpaper: wallpaperService,
        appSettings: settingsService,
        systemCursor: cursorService,
        startup: startupService,
        hotkeys: hotkeyService,
        scanner,
        appGrid: grid,
        safeMode: effectiveSafe,
        safeModeReason
      })

      onSettingsWindowClosed(() => {
        void ai.cancel()
      })
      registerWidgetProtocol({
        widgetsDir,
        builtinsDir,
        sdkDir: join(app.getAppPath(), 'src', 'widget-sdk'),
        fontsDir: join(app.getAppPath(), 'resources', 'fonts'),
        wallpapersDir
      })
      registerIconProtocol({ iconsDir: join(userDataDir, 'cache', 'icons') })
      registerWallpaperProtocol({ wallpapersDir })

      const strategy = resolveWallpaperStrategy()
      const live = new WallpaperLiveService({
        service: wallpaperService,
        strategy: strategy.requested,
        safe: effectiveSafe,
        notices
      })
      wallpaperLive = live

      wallpaperService.onChanged((state) => {
        const settings = getSettingsWindow()
        if (settings && !settings.isDestroyed()) {
          settings.webContents.send(IPC.wallpaperChanged, state)
        }
      })

      const broadcastTheme = (): void => {
        const themeEvent = {
          theme: settingsService.get().theme,
          dark: nativeTheme.shouldUseDarkColors
        }
        layoutService.broadcastWidgetEvent('theme', themeEvent)
        const settings = getSettingsWindow()
        if (settings && !settings.isDestroyed()) {
          settings.webContents.send(IPC.settingsThemeChanged, themeEvent)
        }
      }
      nativeTheme.on('updated', broadcastTheme)

      tray = createTray({
        version: app.getVersion(),
        openSettings: showSettingsWindow,
        quit: () => app.quit(),
        getEditMode,
        toggleEditMode,
        getAddableWidgets: () =>
          BUILTIN_WIDGETS.map((widget) => ({ type: widget.type, name: widget.name })),
        addWidget: (builtinType) => {
          void layoutService.addWidget(builtinType).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error)
            notices.add('error', `Could not add widget: ${message}`)
          })
        },
        getLiveWallpaperPaused: effectiveSafe ? undefined : () => live.isUserPaused(),
        toggleLiveWallpaperPause: effectiveSafe ? undefined : () => live.toggleUserPaused()
      })

      onEditModeChanged(() => {
        layoutService.broadcastState()
        layoutService.broadcastWidgetEvent('editmode', { editMode: getEditMode() })
        tray?.refresh()
        const settings = getSettingsWindow()
        if (settings && !settings.isDestroyed()) {
          settings.webContents.send(IPC.editModeChanged, getEditMode())
        }
      })

      layoutService.onWidgetsChanged(() => {
        const settings = getSettingsWindow()
        if (settings && !settings.isDestroyed()) {
          settings.webContents.send(IPC.widgetsChanged)
        }
      })

      notices.onChange((items) => {
        const settings = getSettingsWindow()
        if (settings && !settings.isDestroyed()) {
          settings.webContents.send(IPC.noticesChanged, items)
        }
      })

      const hotkey = hotkeyService.register(settingsService.get().hotkey)
      if (!hotkey.ok) {
        notices.add(
          'warning',
          `The global edit-layout hotkey could not be registered${hotkey.error ? `: ${hotkey.error}` : ''}. Choose another shortcut in Settings or use the tray menu.`
        )
      }

      metricsLogger = new MetricsLogger()
      metricsLogger.start()

      await wallpaperService.start()
      layoutService.start()
      live.start()

      if (!effectiveSafe) {
        await layoutService.ensureFirstRun()
        await layoutService.restore()
      }

      if (shouldShowSettings) {
        showSettingsWindow()
      }
    })
    .catch((error: unknown) => {
      console.error(error)
      app.quit()
    })
}
