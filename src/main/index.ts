import { app, type Tray } from 'electron'
import { join } from 'node:path'
import { APP_ID } from '../shared/constants'
import { registerIpcHandlers } from './ipc'
import { parseAppFlags, parseWidgetCount } from './lifecycle'
import { registerWidgetProtocol, registerWidgetScheme } from './protocol/widget-protocol'
import log, { initLogger, logStartup } from './services/logger'
import { createTray } from './tray'
import { createWidgetWindows } from './windows/widget-window'
import { showSettingsWindow } from './windows/settings-window'

const flags = parseAppFlags(process.argv)
const hasLock = app.requestSingleInstanceLock()

registerWidgetScheme()

if (!hasLock) {
  app.quit()
} else {
  let tray: Tray | null = null
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

  app.on('before-quit', () => {
    tray?.destroy()
    tray = null
  })

  app
    .whenReady()
    .then(async () => {
      initLogger()
      logStartup(flags)
      registerIpcHandlers()

      registerWidgetProtocol({
        widgetsDir: join(app.getPath('userData'), 'widgets'),
        sdkDir: join(app.getAppPath(), 'src', 'widget-sdk'),
        fontsDir: join(app.getAppPath(), 'resources', 'fonts')
      })

      tray = createTray(showSettingsWindow, () => app.quit())

      if (!flags.safe) {
        await createWidgetWindows(parseWidgetCount())
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
