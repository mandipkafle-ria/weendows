import { extname, join, resolve, sep } from 'node:path'
import { WALLPAPER_ID_RE, WIDGET_ID_RE } from '../../shared/constants'

export interface WidgetProtocolPaths {
  widgetsDir: string
  builtinsDir?: string
  sdkDir: string
  fontsDir: string
  wallpapersDir?: string
}

const WALLPAPER_HOST_PREFIX = 'wp-'
const BUILTIN_PREVIEW_HOST = '_builtins'
const BUILTIN_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isWallpaperHost(host: string): boolean {
  return host.startsWith(WALLPAPER_HOST_PREFIX)
}

export function wallpaperHostId(host: string): string | null {
  if (!isWallpaperHost(host)) {
    return null
  }
  const id = host.slice(WALLPAPER_HOST_PREFIX.length)
  return WALLPAPER_ID_RE.test(id) ? id : null
}

const SDK_TAG = '<script src="widget://_sdk/sdk.js"></script>'
const BASE_STYLE =
  '<style>html, body, :root { background: transparent !important; color-scheme: normal !important; }</style>'
const ENV_TAG =
  '<script>(function(){try{var params=new URLSearchParams(location.search);var env=params.get("env");if(env){var root=document.documentElement;root.dataset.env=env;root.dataset.theme=params.get("theme")||(env==="sky"?"light":"dark")}}catch(error){}})()</script>' +
  '<link rel="stylesheet" href="widget://_builtins/env/theme.css">'

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
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
}

export function mimeFor(file: string): string {
  return MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

export function injectSdk(html: string, withEnv = false): string {
  let result = html.replace(/<meta\s+name=["']color-scheme["'][^>]*>\s*/gi, '')

  if (withEnv) {
    result = /<\/head>/i.test(result)
      ? result.replace(/<\/head>/i, (match) => ENV_TAG + match)
      : result + ENV_TAG
  }

  result = /<\/head>/i.test(result)
    ? result.replace(/<\/head>/i, (match) => BASE_STYLE + match)
    : BASE_STYLE + result

  if (/<head[^>]*>/i.test(result)) {
    return result.replace(/<head[^>]*>/i, (match) => match + SDK_TAG)
  }
  return SDK_TAG + result
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
  let requiresBuiltinId = false

  if (isWallpaperHost(host)) {
    const id = wallpaperHostId(host)
    if (!id || !paths.wallpapersDir) {
      return null
    }
    base = join(paths.wallpapersDir, id)
  } else if (host === BUILTIN_PREVIEW_HOST) {
    if (!paths.builtinsDir) {
      return null
    }
    base = paths.builtinsDir
    requiresBuiltinId = true
  } else if (host === '_sdk') {
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

  if (requiresBuiltinId) {
    const type = pathname.split('/').filter(Boolean)[0]
    if (!type || !BUILTIN_ID_RE.test(type)) {
      return null
    }
  }

  const file = resolve(base, `.${pathname}`)
  if (!file.startsWith(base + sep)) {
    return null
  }

  return file
}
