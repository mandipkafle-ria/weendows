import { protocol, session } from 'electron'
import { readFile } from 'node:fs/promises'
import { WIDGET_CSP, WIDGET_SESSION_PARTITION } from '../../shared/constants'
import log from '../services/logger'
import {
  injectSdk,
  isWallpaperHost,
  mimeFor,
  resolveWidgetFile,
  type WidgetProtocolPaths
} from './widget-paths'

export type { WidgetProtocolPaths } from './widget-paths'
export { injectSdk, mimeFor, resolveWidgetFile } from './widget-paths'

export function registerWidgetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'widget',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    },
    {
      scheme: 'hl-icon',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    },
    {
      scheme: 'hl-wallpaper',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    }
  ])
}

function requestHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function registerWidgetProtocol(paths: WidgetProtocolPaths): void {
  const handle = async (request: Request): Promise<Response> => {
    const file = resolveWidgetFile(paths, request.url)
    if (!file) {
      return new Response('forbidden', { status: 403 })
    }

    try {
      let body: Buffer | string = await readFile(file)
      if (file.toLowerCase().endsWith('index.html') && !isWallpaperHost(requestHost(request.url))) {
        body = injectSdk(body.toString('utf8'))
      }

      const responseBody = typeof body === 'string' ? body : new Uint8Array(body)

      return new Response(responseBody, {
        headers: {
          'Content-Type': mimeFor(file),
          'Content-Security-Policy': WIDGET_CSP,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store'
        }
      })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT' && code !== 'EISDIR') {
        log.warn('Widget protocol read failed', { file, code, error })
      }
      return new Response('not found', { status: 404 })
    }
  }

  protocol.handle('widget', handle)
  session.fromPartition(WIDGET_SESSION_PARTITION).protocol.handle('widget', handle)
}
