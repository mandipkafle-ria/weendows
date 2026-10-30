import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import { powerMonitor } from 'electron'
import {
  WALLPAPER_DEFAULT_INTERVAL_MINUTES,
  WALLPAPER_ID_RE,
  WALLPAPER_VIDEO_WARN_BYTES,
  WALLPAPER_VIDEO_WARN_FPS,
  WALLPAPER_VIDEO_WARN_HEIGHT,
  WALLPAPER_VIDEO_WARN_WIDTH
} from '../../shared/constants'
import { isLiveWallpaperFit, isWallpaperInterval } from '../../shared/wallpaper-fit'
import type {
  WallpaperConfig,
  WallpaperFile,
  WallpaperFit,
  WallpaperItem,
  WallpaperLiveOptions,
  WallpaperSlideshowSettings,
  WallpaperState
} from '../../shared/types'
import log from './logger'
import type { NoticeService } from './notices'
import type { JsonStore } from './store'
import {
  findHtmlIndex,
  validateHtmlSourceFolder,
  validateHtmlWallpaperFolder,
  validateImportFile,
  validateOriginalWallpaper,
  validateStaticWallpaper,
  validateWallpaperFile
} from './wallpaper-paths'
import { nextSlideshowId, WallpaperSlideshow } from './wallpaper-slideshow'

const execFileAsync = promisify(execFile)
import type { WallpaperThumbnails } from './wallpaper-thumbnails'

export interface WallpaperNative {
  readCurrentWallpaperPath: () => Promise<string | null>
  readCurrentWallpaperFit: () => Promise<{ style: string | null; tile: string | null } | null>
  setWallpaper: (file: string, fit: WallpaperFit) => Promise<void>
  setWallpaperPath: (file: string, style?: string | null, tile?: string | null) => Promise<void>
}

export interface WallpaperServiceOptions {
  store: JsonStore<WallpaperFile>
  wallpapersDir: string
  thumbsDir: string
  native: WallpaperNative
  thumbnails: WallpaperThumbnails
  notices?: NoticeService
  safe?: boolean
  now?: () => number
  random?: () => number
  createId?: () => string
  builtinsDir?: string  // resources/builtin-wallpapers/ for built-in wallpaper seed
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function defaultConfig(): WallpaperConfig {
  return {
    mode: 'static',
    currentId: null,
    slideshowIds: [],
    intervalMinutes: WALLPAPER_DEFAULT_INTERVAL_MINUTES,
    shuffle: false,
    pauseOnFullscreen: false,
    pauseOnBattery: false,
    videoMuted: true,
    originalWallpaperPath: null,
    originalWallpaperStyle: null,
    originalWallpaperTile: null,
    lastChangeAt: null
  }
}

export function defaultWallpaperFile(): WallpaperFile {
  return { schema: 1, items: [], config: defaultConfig() }
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })
  for (const entry of entries) {
    const from = join(source, entry.name)
    const to = join(target, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(from, to)
    } else if (entry.isFile()) {
      await copyFile(from, to)
    }
  }
}

function itemName(file: string): string {
  const name = basename(file, extname(file)).trim()
  return (name || 'Wallpaper').slice(0, 120)
}

function folderName(folder: string): string {
  return (basename(folder).trim() || 'HTML wallpaper').slice(0, 120)
}

function lastChangeMs(value: string | null): number | null {
  if (!value) {
    return null
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export class WallpaperService {
  readonly wallpapersDir: string
  private readonly thumbsDir: string
  private readonly store: JsonStore<WallpaperFile>
  private readonly native: WallpaperNative
  private readonly thumbnails: WallpaperThumbnails
  private readonly notices: NoticeService | null
  private readonly safe: boolean
  private readonly now: () => number
  private readonly random: () => number
  private readonly createId: () => string
  private readonly builtinsDir?: string
  private readonly listeners = new Set<(state: WallpaperState) => void>()
  private readonly slideshow: WallpaperSlideshow
  private readonly handleResume = (): void => this.slideshow.recompute()
  private started = false

  constructor(options: WallpaperServiceOptions) {
    this.wallpapersDir = options.wallpapersDir
    this.thumbsDir = options.thumbsDir
    this.store = options.store
    this.native = options.native
    this.thumbnails = options.thumbnails
    this.notices = options.notices ?? null
    this.safe = options.safe ?? false
    this.now = options.now ?? (() => Date.now())
    this.random = options.random ?? Math.random
    this.createId = options.createId ?? (() => randomUUID())
    this.builtinsDir = options.builtinsDir
    this.slideshow = new WallpaperSlideshow({
      intervalMinutes: WALLPAPER_DEFAULT_INTERVAL_MINUTES,
      now: this.now,
      onChange: () => this.advanceSlideshow(),
      onError: (error) => {
        log.error('Slideshow wallpaper change failed', error)
        this.notices?.add(
          'warning',
          `Could not change the slideshow wallpaper: ${messageOf(error)}`
        )
      }
    })
  }

  private async seedBuiltins(data: WallpaperFile): Promise<boolean> {
    let changed = false
    if (!this.builtinsDir) {
      return changed
    }
    const builtinsDir = this.builtinsDir
    try {
      const entries = await readdir(builtinsDir, { withFileTypes: true })

      // Build the set of IDs that currently exist in builtinsDir
      const liveBuiltinIds = new Set<string>()
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const folder = join(builtinsDir, entry.name)
        const indexFile = join(folder, 'index.html')
        try {
          await stat(indexFile)
        } catch {
          continue
        }
        liveBuiltinIds.add(entry.name.toLowerCase().replace(/\s+/g, '-'))
      }

      // Remove stale builtin items that no longer exist in builtinsDir
      const stale = data.items.filter((item) => item.builtin && !liveBuiltinIds.has(item.id))
      if (stale.length > 0) {
        data.items = data.items.filter((item) => !item.builtin || liveBuiltinIds.has(item.id))
        // Also clean up config references to removed IDs
        const removedIds = new Set(stale.map((item) => item.id))
        if (data.config.currentId && removedIds.has(data.config.currentId)) {
          data.config.currentId = null
          data.config.mode = 'static'
        }
        data.config.slideshowIds = data.config.slideshowIds.filter((id) => !removedIds.has(id))
        changed = true
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const folder = join(builtinsDir, entry.name)
        const indexFile = join(folder, 'index.html')
        try {
          await stat(indexFile)
        } catch {
          continue
        }
        const id = entry.name.toLowerCase().replace(/\s+/g, '-')
        const targetDir = join(this.wallpapersDir, id)
        const existing = data.items.find((item) => item.id === id)
        if (existing) {
          if (!isAbsolute(existing.file) || existing.file !== targetDir) {
            existing.file = targetDir
            changed = true
          }
          if (!existing.builtin) {
            existing.builtin = true
            changed = true
          }
          if (!(await findHtmlIndex(targetDir))) {
            await copyDirectory(folder, targetDir)
            changed = true
          }
          continue
        }
        await copyDirectory(folder, targetDir)
        data.items.push({
          id,
          name: entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
          type: 'html',
          file: targetDir,
          fit: 'fill',
          builtin: true
        })
        changed = true
      }
    } catch {
      // If builtins dir is missing or unreadable, skip quietly.
    }
    return changed
  }

  async load(): Promise<void> {
    await this.store.load()
    const data = this.store.get()
    let changed = false

    // Normalize and repair any wallpaper items with relative or legacy paths
    for (const item of data.items) {
      if (item.type === 'html' && !isAbsolute(item.file)) {
        item.file = join(this.wallpapersDir, item.file)
        changed = true
      }
    }

    if (!this.store.hadFile || this.store.recovered) {
      try {
        const original = await this.native.readCurrentWallpaperPath()
        if (original) {
          data.config.originalWallpaperPath = original
          changed = true
        }
      } catch (error) {
        log.warn('Could not capture the original Windows wallpaper', error)
      }
      try {
        const fit = await this.native.readCurrentWallpaperFit()
        if (fit) {
          data.config.originalWallpaperStyle = fit.style
          data.config.originalWallpaperTile = fit.tile
          changed = true
        }
      } catch (error) {
        log.warn('Could not capture the original Windows wallpaper fit', error)
      }
    }

    const imageIds = new Set(
      data.items.filter((item) => item.type === 'image').map((item) => item.id)
    )
    const slideshowIds = data.config.slideshowIds.filter((id) => imageIds.has(id))
    if (slideshowIds.length !== data.config.slideshowIds.length) {
      data.config.slideshowIds = slideshowIds
      changed = true
    }
    if (data.config.slideshowIds.length === 0 && imageIds.size > 0) {
      data.config.slideshowIds = [...imageIds]
      changed = true
    }
    if (
      data.config.currentId !== null &&
      !data.items.some((item) => item.id === data.config.currentId)
    ) {
      data.config.currentId = null
      changed = true
    }
    if (data.config.mode === 'slideshow' && data.config.slideshowIds.length === 0) {
      data.config.mode = 'static'
      changed = true
    }
    if (!isWallpaperInterval(data.config.intervalMinutes)) {
      data.config.intervalMinutes = WALLPAPER_DEFAULT_INTERVAL_MINUTES
      changed = true
    }

    this.slideshow.setIntervalMinutes(data.config.intervalMinutes)

    let seedChanged = false
    if (this.builtinsDir) {
      seedChanged = await this.seedBuiltins(data)
    }

    if (changed || seedChanged) {
      await this.store.flush()
    }
  }

  async start(): Promise<void> {
    if (this.started) {
      return
    }
    this.started = true
    powerMonitor.on('resume', this.handleResume)
    powerMonitor.on('unlock-screen', this.handleResume)

    const config = this.store.get().config
    const current = this.findItem(config.currentId)
    try {
      if (config.mode === 'slideshow' && this.imageItems().length > 0) {
        this.slideshow.setIntervalMinutes(config.intervalMinutes)
        if (current?.type === 'image') {
          await this.native.setWallpaper(
            await validateStaticWallpaper(this.wallpapersDir, current.file),
            current.fit
          )
        } else {
          await this.advanceSlideshow()
        }
        this.slideshow.start(lastChangeMs(this.store.get().config.lastChangeAt))
      } else if (current?.type === 'image') {
        await this.native.setWallpaper(
          await validateStaticWallpaper(this.wallpapersDir, current.file),
          current.fit
        )
      }
    } catch (error) {
      log.error('Could not restore the wallpaper on startup', error)
      this.notices?.add('warning', `Could not restore the wallpaper: ${messageOf(error)}`)
    }
  }

  stop(): void {
    this.started = false
    powerMonitor.removeListener('resume', this.handleResume)
    powerMonitor.removeListener('unlock-screen', this.handleResume)
    this.slideshow.stop()
  }

  async flush(): Promise<void> {
    await this.store.flush()
  }

  onChanged(listener: (state: WallpaperState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState(): WallpaperState {
    const data = this.store.get()
    return {
      items: data.items.map((item) => ({ ...item })),
      config: { ...data.config, slideshowIds: [...data.config.slideshowIds] }
    }
  }

  async addFiles(sources: readonly string[]): Promise<WallpaperState> {
    const imported: WallpaperItem[] = []
    const createdDirs: string[] = []
    const createdThumbs: string[] = []

    try {
      for (const source of sources) {
        const validated = await validateImportFile(source)
        const id = this.createId()
        if (!WALLPAPER_ID_RE.test(id)) {
          throw new Error('Could not create a wallpaper id')
        }
        const directory = join(this.wallpapersDir, id)
        await mkdir(directory, { recursive: true })
        createdDirs.push(directory)
        const target = join(directory, basename(validated.file))
        await copyFile(validated.file, target)
        if (validated.type === 'video') {
          await this.warnLargeVideo(target)
          void this.warnVideoProperties(target)
        }
        const poster = await this.thumbnails.create(validated.type, target, id)
        createdThumbs.push(poster)
        imported.push({
          id,
          name: itemName(validated.file),
          type: validated.type,
          file: target,
          fit: 'fill',
          ...(validated.type === 'video' ? { posterFile: poster } : {})
        })
      }

      if (imported.length === 0) {
        return this.getState()
      }

      this.store.update((data) => {
        data.items.push(...imported)
        for (const item of imported) {
          if (item.type === 'image' && !data.config.slideshowIds.includes(item.id)) {
            data.config.slideshowIds.push(item.id)
          }
        }
      })
      this.emit()
      return this.getState()
    } catch (error) {
      for (const thumb of createdThumbs) {
        await rm(thumb, { force: true }).catch(() => undefined)
      }
      for (const directory of createdDirs) {
        await rm(directory, { recursive: true, force: true }).catch(() => undefined)
      }
      throw error
    }
  }

  async addHtmlFolder(source: string): Promise<WallpaperState> {
    const validated = await validateHtmlSourceFolder(source)
    const id = this.createId()
    if (!WALLPAPER_ID_RE.test(id)) {
      throw new Error('Could not create a wallpaper id')
    }
    const directory = join(this.wallpapersDir, id)

    try {
      await copyDirectory(validated.folder, directory)
      if (!(await findHtmlIndex(directory))) {
        throw new Error('HTML wallpaper folder must contain index.html')
      }
      const item: WallpaperItem = {
        id,
        name: folderName(validated.folder),
        type: 'html',
        file: directory,
        fit: 'fill'
      }
      this.store.update((data) => {
        data.items.push(item)
      })
      this.emit()
      return this.getState()
    } catch (error) {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined)
      throw error
    }
  }

  async remove(id: string): Promise<WallpaperState> {
    const data = this.store.get()
    const item = data.items.find((candidate) => candidate.id === id)
    if (!item) {
      return this.getState()
    }

    const wasCurrent = data.config.currentId === id
    const wasSlideshow = data.config.mode === 'slideshow'
    this.store.update((current) => {
      current.items = current.items.filter((candidate) => candidate.id !== id)
      current.config.slideshowIds = current.config.slideshowIds.filter(
        (candidate) => candidate !== id
      )
      if (current.config.currentId === id) {
        current.config.currentId = null
      }
    })

    await rm(join(this.wallpapersDir, id), { recursive: true, force: true }).catch(() => undefined)
    await rm(join(this.thumbsDir, `${id}.png`), { force: true }).catch(() => undefined)

    if (wasCurrent) {
      if (wasSlideshow && this.imageItems().length > 0) {
        await this.advanceSlideshow().catch((error: unknown) => {
          log.error('Could not advance the slideshow after removing its current wallpaper', error)
        })
      } else {
        this.slideshow.stop()
        this.store.update((current) => {
          current.config.mode = 'static'
          current.config.lastChangeAt = null
        })
        const config = this.store.get().config
        if (config.originalWallpaperPath) {
          try {
            await this.native.setWallpaperPath(
              await validateOriginalWallpaper(config.originalWallpaperPath),
              config.originalWallpaperStyle,
              config.originalWallpaperTile
            )
          } catch (error) {
            log.warn('Could not restore the original wallpaper after removal', error)
          }
        }
      }
    }

    this.emit()
    return this.getState()
  }

  async setStatic(id: string, fit: WallpaperFit): Promise<WallpaperState> {
    const item = this.findItem(id)
    if (!item) {
      throw new Error('Wallpaper not found')
    }
    const file = await validateStaticWallpaper(this.wallpapersDir, item.file)
    await this.native.setWallpaper(file, fit)
    this.slideshow.stop()
    this.store.update((data) => {
      const target = data.items.find((candidate) => candidate.id === id)
      if (target) {
        target.fit = fit
      }
      data.config.mode = 'static'
      data.config.currentId = id
      data.config.lastChangeAt = null
    })
    this.emit()
    return this.getState()
  }

  async setLive(id: string, fit: WallpaperFit): Promise<WallpaperState> {
    if (this.safe) {
      throw new Error('Live wallpapers are disabled in safe mode')
    }
    if (process.platform !== 'win32') {
      throw new Error('Live wallpapers are only supported on Windows')
    }
    if (!isLiveWallpaperFit(fit)) {
      throw new Error('Live wallpapers support Fill, Fit, Stretch, or Center')
    }

    const item = this.findItem(id)
    if (!item) {
      throw new Error('Wallpaper not found')
    }
    if (item.type === 'image') {
      throw new Error('Use a static wallpaper for image files')
    }
    if (item.type === 'video') {
      const source = await validateWallpaperFile(this.wallpapersDir, item.file)
      if (source.type !== 'video') {
        throw new Error('Wallpaper is not a supported video')
      }
      await this.warnLargeVideo(source.file)
    } else {
      await validateHtmlWallpaperFolder(this.wallpapersDir, item.file)
    }

    this.slideshow.stop()
    await this.applyStaticFallback(item)
    this.store.update((data) => {
      const target = data.items.find((candidate) => candidate.id === id)
      if (target) {
        target.fit = fit
      }
      data.config.mode = 'live'
      data.config.currentId = id
      data.config.lastChangeAt = null
    })
    this.emit()
    return this.getState()
  }

  async setInteractive(id: string, interactive: boolean): Promise<WallpaperState> {
    const item = this.findItem(id)
    if (!item || item.type !== 'html') {
      throw new Error('Only HTML wallpapers can be interactive')
    }
    this.store.update((data) => {
      const target = data.items.find((candidate) => candidate.id === id)
      if (target) {
        target.interactive = interactive
      }
    })
    this.emit()
    return this.getState()
  }

  async setLiveOptions(options: WallpaperLiveOptions): Promise<WallpaperState> {
    this.store.update((data) => {
      data.config.pauseOnBattery = options.pauseOnBattery
      data.config.videoMuted = options.videoMuted
    })
    this.emit()
    return this.getState()
  }

  async applyStaticFallback(item: WallpaperItem): Promise<void> {
    if (item.type === 'video' && item.posterFile) {
      try {
        const poster = await validateStaticWallpaper(this.wallpapersDir, item.posterFile)
        await this.native.setWallpaper(poster, isLiveWallpaperFit(item.fit) ? item.fit : 'fill')
        return
      } catch (error) {
        log.warn('Could not apply the video poster fallback', error)
      }
    }

    const config = this.store.get().config
    if (config.originalWallpaperPath) {
      try {
        const original = await validateOriginalWallpaper(config.originalWallpaperPath)
        await this.native.setWallpaperPath(
          original,
          config.originalWallpaperStyle,
          config.originalWallpaperTile
        )
        return
      } catch (error) {
        log.warn('Could not apply the original wallpaper fallback', error)
      }
    }

    const fallback = this.imageItems()[0]
    if (fallback) {
      try {
        const file = await validateStaticWallpaper(this.wallpapersDir, fallback.file)
        await this.native.setWallpaper(file, fallback.fit)
        return
      } catch (error) {
        log.warn('Could not apply a library image fallback', error)
      }
    }

    this.notices?.add(
      'warning',
      'Live wallpaper started without a static fallback image. A black desktop may appear if HomeLayer closes unexpectedly.'
    )
  }

  async setSlideshow(settings: WallpaperSlideshowSettings): Promise<WallpaperState> {
    if (!isWallpaperInterval(settings.intervalMinutes)) {
      throw new Error('Invalid slideshow interval')
    }

    const images = this.imageItems()
    if (settings.enabled && images.length === 0) {
      throw new Error('Add an image wallpaper before starting the slideshow')
    }

    const config = this.store.get().config
    const wasSlideshow = config.mode === 'slideshow'

    if (!settings.enabled) {
      this.store.update((data) => {
        data.config.mode = 'static'
        data.config.intervalMinutes = settings.intervalMinutes
        data.config.shuffle = settings.shuffle
        data.config.lastChangeAt = null
      })
      this.slideshow.stop()
      this.emit()
      return this.getState()
    }

    const current = this.findItem(config.currentId)
    const currentIsImage =
      current?.type === 'image' && images.some((item) => item.id === current.id)
    const start = currentIsImage ? current : images[0]
    if (!start) {
      throw new Error('Add an image wallpaper before starting the slideshow')
    }

    if (!wasSlideshow || !currentIsImage) {
      const file = await validateStaticWallpaper(this.wallpapersDir, start.file)
      await this.native.setWallpaper(file, start.fit)
      const startedAt = this.now()
      this.store.update((data) => {
        data.config.mode = 'slideshow'
        data.config.slideshowIds = images.map((item) => item.id)
        data.config.intervalMinutes = settings.intervalMinutes
        data.config.shuffle = settings.shuffle
        data.config.currentId = start.id
        data.config.lastChangeAt = new Date(startedAt).toISOString()
      })
      this.slideshow.setIntervalMinutes(settings.intervalMinutes)
      this.slideshow.start(startedAt)
    } else {
      this.store.update((data) => {
        data.config.slideshowIds = images.map((item) => item.id)
        data.config.intervalMinutes = settings.intervalMinutes
        data.config.shuffle = settings.shuffle
        data.config.currentId = start.id
      })
      this.slideshow.setIntervalMinutes(settings.intervalMinutes)
      this.slideshow.recompute()
    }

    this.emit()
    return this.getState()
  }

  async restoreOriginal(): Promise<WallpaperState> {
    const config = this.store.get().config
    if (!config.originalWallpaperPath) {
      throw new Error('The original Windows wallpaper was not captured')
    }
    const file = await validateOriginalWallpaper(config.originalWallpaperPath)
    await this.native.setWallpaperPath(
      file,
      config.originalWallpaperStyle,
      config.originalWallpaperTile
    )
    this.slideshow.stop()
    this.store.update((data) => {
      data.config.mode = 'static'
      data.config.currentId = null
      data.config.lastChangeAt = null
    })
    this.emit()
    return this.getState()
  }

  private async warnLargeVideo(file: string): Promise<void> {
    try {
      const info = await stat(file)
      if (info.size > WALLPAPER_VIDEO_WARN_BYTES) {
        this.notices?.add(
          'warning',
          `This video wallpaper is ${(info.size / (1024 * 1024)).toFixed(0)} MB. Videos above 500 MB may use a lot of memory and disk bandwidth.`
        )
      }
    } catch (error) {
      log.warn('Could not read the video wallpaper size', error)
    }
  }

  private async warnVideoProperties(file: string): Promise<void> {
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        [
          '-v',
          'error',
          '-select_streams',
          'v:0',
          '-show_entries',
          'stream=width,height,r_frame_rate',
          '-of',
          'json',
          file
        ],
        { timeout: 5000, windowsHide: true }
      )
      const parsed = JSON.parse(stdout) as {
        streams?: Array<{ width?: number; height?: number; r_frame_rate?: string }>
      }
      const stream = parsed.streams?.[0]
      if (!stream) {
        return
      }
      const width = stream.width ?? 0
      const height = stream.height ?? 0
      const rate = stream.r_frame_rate ?? ''
      const [numerator, denominator] = rate.split('/').map(Number)
      const fps =
        numerator !== undefined && denominator !== undefined && denominator > 0
          ? numerator / denominator
          : Number(rate)
      if (
        width > WALLPAPER_VIDEO_WARN_WIDTH ||
        height > WALLPAPER_VIDEO_WARN_HEIGHT ||
        (Number.isFinite(fps) && fps > WALLPAPER_VIDEO_WARN_FPS)
      ) {
        this.notices?.add(
          'warning',
          `This video wallpaper is ${width}x${height}${Number.isFinite(fps) ? ` at ${fps.toFixed(0)} fps` : ''}. For lower CPU and GPU use, 1080p at 30 fps or lower is recommended.`
        )
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        log.debug('Could not probe video properties', { file, code })
      }
    }
  }

  private findItem(id: string | null): WallpaperItem | null {
    if (!id) {
      return null
    }
    return this.store.get().items.find((item) => item.id === id) ?? null
  }

  private imageItems(): WallpaperItem[] {
    return this.store.get().items.filter((item) => item.type === 'image')
  }

  private async advanceSlideshow(): Promise<void> {
    const data = this.store.get()
    if (data.config.mode !== 'slideshow') {
      return
    }

    const images = this.imageItems()
    const imageIds = new Set(images.map((item) => item.id))
    const ids = data.config.slideshowIds.filter((id) => imageIds.has(id))
    const candidates = ids.length > 0 ? ids : images.map((item) => item.id)
    const nextId = nextSlideshowId(
      candidates,
      data.config.currentId,
      data.config.shuffle,
      this.random
    )
    const next = nextId ? this.findItem(nextId) : null
    if (!next) {
      this.slideshow.stop()
      this.store.update((current) => {
        current.config.mode = 'static'
        current.config.lastChangeAt = null
      })
      this.emit()
      return
    }

    const file = await validateStaticWallpaper(this.wallpapersDir, next.file)
    await this.native.setWallpaper(file, next.fit)
    if (this.store.get().config.mode !== 'slideshow') {
      return
    }
    const changedAt = new Date(this.now()).toISOString()
    this.store.update((current) => {
      current.config.currentId = next.id
      current.config.lastChangeAt = changedAt
    })
    this.slideshow.setLastChangeAt(this.now())
    this.emit()
  }

  private emit(): void {
    const state = this.getState()
    for (const listener of this.listeners) {
      try {
        listener(state)
      } catch (error) {
        log.warn('Wallpaper change listener failed', error)
      }
    }
  }
}
