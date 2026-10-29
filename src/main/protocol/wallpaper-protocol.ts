import { protocol, session } from 'electron'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { Readable } from 'node:stream'
import { WALLPAPER_ID_RE, WIDGET_SESSION_PARTITION } from '../../shared/constants'
import log from '../services/logger'

export interface WallpaperProtocolPaths {
  wallpapersDir: string
}

export interface ByteRange {
  start: number
  end: number
}

const MEDIA_MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  // Wallpaper images share this host so the settings desktop map can show the
  // real wallpaper instead of the 320 px thumbnail.
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

export function resolveWallpaperThumbnail(
  wallpapersDir: string,
  requestUrl: string
): string | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'hl-wallpaper:' || url.hostname !== 'thumb') {
    return null
  }
  const id = url.pathname.replace(/^\/+/, '')
  if (!WALLPAPER_ID_RE.test(id)) {
    return null
  }
  return join(wallpapersDir, 'thumbs', `${id}.png`)
}

export function resolveWallpaperMedia(
  wallpapersDir: string,
  requestUrl: string
): { file: string; mime: string } | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'hl-wallpaper:' || url.hostname !== 'media') {
    return null
  }

  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return null
  }

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 2) {
    return null
  }
  const [id, filename] = segments
  if (!id || !filename || !WALLPAPER_ID_RE.test(id) || basename(filename) !== filename) {
    return null
  }
  const mime = MEDIA_MIME_TYPES[extname(filename).toLowerCase()]
  if (!mime) {
    return null
  }
  return { file: join(wallpapersDir, id, filename), mime }
}

export function parseByteRange(header: string | null, size: number): ByteRange | 'invalid' | null {
  if (!header) {
    return null
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    return 'invalid'
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match) {
    return 'invalid'
  }
  const startText = match[1] ?? ''
  const endText = match[2] ?? ''
  if (!startText && !endText) {
    return 'invalid'
  }

  let start: number
  let end: number
  if (!startText) {
    const suffixLength = Number(endText)
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return 'invalid'
    }
    start = Math.max(0, size - suffixLength)
    end = size - 1
  } else {
    start = Number(startText)
    end = endText ? Number(endText) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return 'invalid'
    }
    if (start >= size || start > end) {
      return 'invalid'
    }
    end = Math.min(end, size - 1)
  }
  return { start, end }
}

function bodyFor(file: string, start?: number, end?: number): ReadableStream {
  const stream = createReadStream(file, start === undefined ? {} : { start, end })
  return Readable.toWeb(stream) as unknown as ReadableStream
}

export function registerWallpaperProtocol(paths: WallpaperProtocolPaths): void {
  const handle = async (request: Request): Promise<Response> => {
    const media = resolveWallpaperMedia(paths.wallpapersDir, request.url)
    if (!media) {
      const file = resolveWallpaperThumbnail(paths.wallpapersDir, request.url)
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
          log.warn('Wallpaper protocol read failed', { file, code })
        }
        return new Response('not found', { status: 404 })
      }
    }

    let size: number
    try {
      const info = await stat(media.file)
      if (!info.isFile()) {
        return new Response('not found', { status: 404 })
      }
      size = info.size
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        log.warn('Wallpaper media stat failed', { file: media.file, code })
      }
      return new Response('not found', { status: 404 })
    }

    const range = parseByteRange(request.headers.get('range'), size)
    const commonHeaders = {
      'Content-Type': media.mime,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    }
    if (range === 'invalid') {
      return new Response(null, {
        status: 416,
        headers: { ...commonHeaders, 'Content-Range': `bytes */${size}` }
      })
    }

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: range ? 206 : 200,
        headers: {
          ...commonHeaders,
          'Content-Length': String(range ? range.end - range.start + 1 : size),
          ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${size}` } : {})
        }
      })
    }

    if (range) {
      return new Response(bodyFor(media.file, range.start, range.end), {
        status: 206,
        headers: {
          ...commonHeaders,
          'Content-Length': String(range.end - range.start + 1),
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`
        }
      })
    }

    return new Response(bodyFor(media.file), {
      status: 200,
      headers: { ...commonHeaders, 'Content-Length': String(size) }
    })
  }

  protocol.handle('hl-wallpaper', handle)
  session.fromPartition(WIDGET_SESSION_PARTITION).protocol.handle('hl-wallpaper', handle)
}
