import { app } from 'electron'
import { basename, join } from 'node:path'
import { APP_ID, LAYOUT_WRITE_DEBOUNCE_MS } from '../shared/constants'
import { IPC } from '../shared/ipc'
import { layoutFileSchema } from '../shared/schemas'
import type { LayoutFile } from '../shared/types'
import { registerEditModeHotkey, unregisterHotkeys } from './hotkeys'
import { registerIpcHandlers } from './ipc'
import { parseAppFlags } from './lifecycle'
import { registerWidgetProtocol, registerWidgetScheme } from './protocol/widget-protocol'
import { getEditMode, onEditModeChanged, setEditMode, toggleEditMode } from './services/edit-mode'
import log, { initLogger, logStartup } from './services/logger'
import { NoticeService } from './services/notices'
import { JsonStore } from './services/store'
import { WidgetService } from './services/widget-service'
import { createTray, type TrayController } from './tray'
import { LayoutService } from './windows/layout'
import { getSettingsWindow, showSettingsWindow } from './windows/settings-window'

const flags = parseAppFlags(process.argv)
const hasLock = app.requestSingleInstanceLock()

let tray: TrayController | null = null
let layout: LayoutService | null = null
let widgetService: WidgetService | null = null
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
    unregisterHotkeys()
  })

  app.on('before-quit', (event) => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    event.preventDefault()

    tray?.destroy()
    tray = null
    unregisterHotkeys()
    layout?.stop()

    const flush = widgetService ? widgetService.flush() : Promise.resolve()
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

      const notices = new NoticeService()
      const widgetsDir = join(app.getPath('userData'), 'widgets')
      const builtinsDir = join(app.getAppPath(), 'resources', 'builtin-widgets')
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
        safe: flags.safe
      })
      layout = layoutService

      registerIpcHandlers({ widgetService: service, layout: layoutService, notices })
      registerWidgetProtocol({
        widgetsDir,
        sdkDir: join(app.getAppPath(), 'src', 'widget-sdk'),
        fontsDir: join(app.getAppPath(), 'resources', 'fonts')
      })

      tray = createTray({
        openSettings: showSettingsWindow,
        quit: () => app.quit(),
        getEditMode,
        toggleEditMode
      })

      onEditModeChanged(() => {
        layoutService.broadcastState()
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

      const hotkey = registerEditModeHotkey(() => {
        setEditMode(!getEditMode())
      })
      if (!hotkey.ok) {
        notices.add(
          'warning',
          `The global edit-layout hotkey could not be registered${hotkey.error ? `: ${hotkey.error}` : ''}. Use the tray menu instead.`
        )
      }

      layoutService.start()

      if (!flags.safe) {
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
