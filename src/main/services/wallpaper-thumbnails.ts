import { BrowserWindow, nativeImage } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { WALLPAPER_THUMBNAIL_WIDTH } from '../../shared/constants'
import log from './logger'

const VIDEO_CAPTURE_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Video thumbnail timed out')), ms)
    promise.then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

export class WallpaperThumbnails {
  readonly thumbsDir: string

  constructor(thumbsDir: string) {
    this.thumbsDir = thumbsDir
  }

  async create(type: 'image' | 'video', source: string, id: string): Promise<string> {
    const png = type === 'image' ? await this.imagePng(source) : await this.videoPng(source)
    await mkdir(this.thumbsDir, { recursive: true })
    const target = join(this.thumbsDir, `${id}.png`)
    await writeFile(target, png)
    return target
  }

  private async imagePng(source: string): Promise<Buffer> {
    const image = nativeImage.createFromPath(source)
    if (image.isEmpty()) {
      throw new Error('Could not read the image wallpaper')
    }
    return image.resize({ width: WALLPAPER_THUMBNAIL_WIDTH }).toPNG()
  }

  private async videoPng(source: string): Promise<Buffer> {
    try {
      return await this.captureVideoFrame(source)
    } catch (error) {
      log.warn('Hidden video thumbnail capture failed; trying the Windows thumbnail', error)
    }

    try {
      const image = await nativeImage.createThumbnailFromPath(source, {
        width: WALLPAPER_THUMBNAIL_WIDTH,
        height: Math.round((WALLPAPER_THUMBNAIL_WIDTH * 9) / 16)
      })
      if (!image.isEmpty()) {
        return image.toPNG()
      }
    } catch (error) {
      log.warn('Windows video thumbnail failed', error)
    }

    throw new Error('Could not create a thumbnail for the video wallpaper')
  }

  private async captureVideoFrame(source: string): Promise<Buffer> {
    const win = new BrowserWindow({
      show: false,
      width: 640,
      height: 360,
      paintWhenInitiallyHidden: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: false,
        backgroundThrottling: false
      }
    })

    try {
      const fileUrl = pathToFileURL(source).href
      const devUrl = process.env['ELECTRON_RENDERER_URL']
      if (devUrl) {
        await win.loadURL(
          `${devUrl.replace(/\/$/, '')}/wallpaper-thumbnail/index.html?file=${encodeURIComponent(fileUrl)}`
        )
      } else {
        await win.loadFile(join(__dirname, '../renderer/wallpaper-thumbnail/index.html'), {
          query: { file: fileUrl }
        })
      }

      const result: unknown = await withTimeout(
        win.webContents.executeJavaScript('window.__captureWallpaperFrame?.()'),
        VIDEO_CAPTURE_TIMEOUT_MS
      )
      if (typeof result !== 'string' || !result.startsWith('data:image/png;base64,')) {
        throw new Error('Video page did not return a PNG')
      }
      return Buffer.from(result.slice('data:image/png;base64,'.length), 'base64')
    } finally {
      if (!win.isDestroyed()) {
        win.destroy()
      }
    }
  }
}
