import { app, session, type Session } from 'electron'
import { WIDGET_SESSION_PARTITION } from '../../shared/constants'
import log from './logger'

const BLOCKED_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:', 'ftp:'])

function protocolOf(url: string): string | null {
  try {
    return new URL(url).protocol
  } catch {
    return null
  }
}

function isDevServerUrl(url: string): boolean {
  if (app.isPackaged) {
    return false
  }
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!devUrl) {
    return false
  }
  try {
    return new URL(url).origin === new URL(devUrl).origin
  } catch {
    return false
  }
}

export function configureWidgetSession(): Session {
  const widgetSession = session.fromPartition(WIDGET_SESSION_PARTITION)

  widgetSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const protocol = protocolOf(details.url)
    if (protocol && BLOCKED_PROTOCOLS.has(protocol)) {
      if (isDevServerUrl(details.url)) {
        callback({})
        return
      }
      log.debug('Blocked widget network request', {
        protocol,
        resourceType: details.resourceType
      })
      callback({ cancel: true })
      return
    }
    callback({})
  })

  widgetSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  widgetSession.setPermissionCheckHandler(() => false)
  widgetSession.setDevicePermissionHandler(() => false)

  return widgetSession
}
