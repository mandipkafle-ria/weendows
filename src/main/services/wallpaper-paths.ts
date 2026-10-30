import { readdir, realpath, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, sep } from 'node:path'

export const WALLPAPER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.bmp'])
export const WALLPAPER_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm'])

function normalized(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value
}

export function isPathInside(base: string, candidate: string): boolean {
  const rel = relative(normalized(base), normalized(candidate))
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

export function wallpaperTypeForPath(file: string): 'image' | 'video' | null {
  const extension = extname(file).toLowerCase()
  if (WALLPAPER_IMAGE_EXTENSIONS.has(extension)) {
    return 'image'
  }
  if (WALLPAPER_VIDEO_EXTENSIONS.has(extension)) {
    return 'video'
  }
  return null
}

async function absoluteFile(file: string, label: string): Promise<string> {
  if (!isAbsolute(file)) {
    throw new Error(`${label} must be an absolute path`)
  }
  const resolved = await realpath(file)
  const stats = await stat(resolved)
  if (!stats.isFile()) {
    throw new Error(`${label} is not a file`)
  }
  return resolved
}

export async function validateImportFile(
  source: string
): Promise<{ file: string; type: 'image' | 'video' }> {
  const file = await absoluteFile(source, 'Wallpaper source')
  const type = wallpaperTypeForPath(file)
  if (type === null) {
    throw new Error('Wallpaper must be a JPG, JPEG, PNG, BMP, MP4, or WebM file')
  }
  return { file, type }
}

export async function validateWallpaperFile(
  wallpapersDir: string,
  file: string
): Promise<{ file: string; type: 'image' | 'video' }> {
  const source = await validateImportFile(file)
  const base = await realpath(wallpapersDir)
  if (!isPathInside(base, source.file)) {
    throw new Error('Wallpaper path is outside the wallpaper library')
  }
  return source
}

export async function validateStaticWallpaper(
  wallpapersDir: string,
  file: string
): Promise<string> {
  const source = await validateWallpaperFile(wallpapersDir, file)
  if (source.type !== 'image') {
    throw new Error('Only image wallpapers can be set in Phase 6A')
  }
  return source.file
}

export async function validateOriginalWallpaper(file: string): Promise<string> {
  const resolved = await absoluteFile(file, 'Original wallpaper')
  if (wallpaperTypeForPath(resolved) !== 'image') {
    throw new Error('Original wallpaper is not a supported image')
  }
  return resolved
}

export async function findHtmlIndex(folder: string): Promise<string | null> {
  const entries = await readdir(folder, { withFileTypes: true })
  const entry = entries.find(
    (candidate) => candidate.isFile() && candidate.name.toLowerCase() === 'index.html'
  )
  return entry ? join(folder, entry.name) : null
}

export async function validateHtmlSourceFolder(
  folder: string
): Promise<{ folder: string; indexFile: string }> {
  if (!isAbsolute(folder)) {
    throw new Error('HTML wallpaper folder must be an absolute path')
  }
  const resolved = await realpath(folder)
  const stats = await stat(resolved)
  if (!stats.isDirectory()) {
    throw new Error('HTML wallpaper source is not a folder')
  }
  const indexFile = await findHtmlIndex(resolved)
  if (!indexFile) {
    throw new Error('HTML wallpaper folder must contain index.html')
  }
  return { folder: resolved, indexFile }
}

export async function validateHtmlWallpaperFolder(
  wallpapersDir: string,
  folder: string
): Promise<{ folder: string; indexFile: string }> {
  const resolved = isAbsolute(folder) ? folder : join(wallpapersDir, folder)
  const source = await validateHtmlSourceFolder(resolved)
  const base = await realpath(wallpapersDir)
  if (!isPathInside(base, source.folder)) {
    throw new Error('HTML wallpaper folder is outside the wallpaper library')
  }
  return source
}
