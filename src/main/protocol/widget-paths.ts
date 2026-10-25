import { extname, join, resolve, sep } from 'node:path'
import { WIDGET_ID_RE } from '../../shared/constants'

export interface WidgetProtocolPaths {
  widgetsDir: string
  sdkDir: string
  fontsDir: string
}

const SDK_TAG = '<script src="widget://_sdk/sdk.js"></script>'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4'
}

export function mimeFor(file: string): string {
  return MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

export function injectSdk(html: string): string {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => match + SDK_TAG)
  }
  return SDK_TAG + html
}

export function resolveWidgetFile(paths: WidgetProtocolPaths, requestUrl: string): string | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }

  if (url.protocol !== 'widget:') {
    return null
  }

  const host = url.hostname.toLowerCase()
  let base: string

  if (host === '_sdk') {
    base = paths.sdkDir
  } else if (host === '_fonts') {
    base = paths.fontsDir
  } else {
    if (!WIDGET_ID_RE.test(host)) {
      return null
    }
    base = join(paths.widgetsDir, host)
  }

  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return null
  }

  if (pathname === '' || pathname === '/') {
    pathname = '/index.html'
  }

  const file = resolve(base, `.${pathname}`)
  if (!file.startsWith(base + sep)) {
    return null
  }

  return file
}
