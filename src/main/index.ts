import { app, type Tray } from 'electron'
import { APP_ID } from '../shared/constants'
import { registerIpcHandlers } from './ipc'
import { parseAppFlags } from './lifecycle'
import log, { initLogger, logStartup } from './services/logger'
import { createTray } from './tray'
import { showSettingsWindow } from './windows/settings-window'

const flags = parseAppFlags(process.argv)
const hasLock = app.requestSingleInstanceLock()

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
    .then(() => {
      initLogger()
      logStartup(flags)
      registerIpcHandlers()
      tray = createTray(showSettingsWindow, () => app.quit())

      if (shouldShowSettings) {
        showSettingsWindow()
      }
    })
    .catch((error: unknown) => {
      console.error(error)
      app.quit()
    })
}
