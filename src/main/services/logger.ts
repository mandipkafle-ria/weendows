import { app } from 'electron'
import log from 'electron-log/main'
import { join } from 'node:path'
import os from 'node:os'
import type { AppFlags } from '../lifecycle'

export function initLogger(): void {
  log.transports.file.resolvePathFn = () => join(app.getPath('userData'), 'logs', 'main.log')
  log.transports.file.level = 'info'
  log.transports.console.level = 'info'
}

export function logStartup(flags: AppFlags): void {
  log.info(`HomeLayer ${app.getVersion()} starting`)
  log.info(`Windows ${os.release()}`)
  log.info(
    `Electron ${process.versions.electron ?? 'unknown'} | Chromium ${process.versions.chrome ?? 'unknown'} | Node ${process.versions.node}`
  )
  if (flags.hidden) {
    log.info('Started hidden')
  }
  if (flags.safe) {
    log.warn('Safe mode enabled')
  }
}

export default log
