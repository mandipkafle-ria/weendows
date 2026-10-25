import { protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { WIDGET_CSP } from '../../shared/constants'
import log from '../services/logger'
import { injectSdk, mimeFor, resolveWidgetFile, type WidgetProtocolPaths } from './widget-paths'

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
    }
  ])
}

export function registerWidgetProtocol(paths: WidgetProtocolPaths): void {
  protocol.handle('widget', async (request) => {
    const file = resolveWidgetFile(paths, request.url)
    if (!file) {
      return new Response('forbidden', { status: 403 })
    }

    try {
      let body: Buffer | string = await readFile(file)
      if (file.toLowerCase().endsWith('index.html')) {
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
  })
}
