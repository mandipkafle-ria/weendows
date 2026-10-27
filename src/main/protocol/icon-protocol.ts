import { protocol, session } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { APP_ICON_ID_RE, WIDGET_SESSION_PARTITION } from '../../shared/constants'
import log from '../services/logger'

export interface IconProtocolPaths {
  iconsDir: string
}

export function resolveIconFile(iconsDir: string, requestUrl: string): string | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'hl-icon:') {
    return null
  }
  const id = url.hostname.toLowerCase()
  if (!APP_ICON_ID_RE.test(id)) {
    return null
  }
  if (url.pathname !== '' && url.pathname !== '/') {
    return null
  }
  return join(iconsDir, `${id}.png`)
}

export function registerIconProtocol(paths: IconProtocolPaths): void {
  const handle = async (request: Request): Promise<Response> => {
    const file = resolveIconFile(paths.iconsDir, request.url)
    if (!file) {
      return new Response('forbidden', { status: 403 })
    }
    try {
      const body = await readFile(file)
      return new Response(new Uint8Array(body), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff'
        }
      })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        log.warn('Icon protocol read failed', { file, code })
      }
      return new Response('not found', { status: 404 })
    }
  }

  protocol.handle('hl-icon', handle)
  session.fromPartition(WIDGET_SESSION_PARTITION).protocol.handle('hl-icon', handle)
}
