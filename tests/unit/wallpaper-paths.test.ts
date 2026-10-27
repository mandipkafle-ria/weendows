import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isPathInside,
  validateHtmlSourceFolder,
  validateHtmlWallpaperFolder,
  validateOriginalWallpaper,
  validateStaticWallpaper,
  validateWallpaperFile,
  wallpaperTypeForPath
} from '../../src/main/services/wallpaper-paths'

let root: string
let wallpapersDir: string
let outsideDir: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'homelayer-wallpaper-paths-'))
  wallpapersDir = join(root, 'wallpapers')
  outsideDir = join(root, 'outside')
  await mkdir(wallpapersDir, { recursive: true })
  await mkdir(outsideDir, { recursive: true })
  await writeFile(join(wallpapersDir, 'image.jpg'), 'image')
  await writeFile(join(wallpapersDir, 'clip.mp4'), 'video')
  await writeFile(join(wallpapersDir, 'notes.txt'), 'text')
  await writeFile(join(outsideDir, 'outside.png'), 'image')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('wallpaper path validation', () => {
  it('accepts an absolute image inside the wallpaper library', async () => {
    const file = join(wallpapersDir, 'image.jpg')
    await expect(validateWallpaperFile(wallpapersDir, file)).resolves.toEqual({
      file: await realpath(file),
      type: 'image'
    })
    await expect(validateStaticWallpaper(wallpapersDir, file)).resolves.toBe(await realpath(file))
  })

  it('rejects relative, outside, missing, and unsupported paths', async () => {
    await expect(validateWallpaperFile(wallpapersDir, 'wallpapers/image.jpg')).rejects.toThrow(
      /absolute/
    )
    await expect(
      validateWallpaperFile(wallpapersDir, join(outsideDir, 'outside.png'))
    ).rejects.toThrow(/outside/)
    await expect(
      validateWallpaperFile(wallpapersDir, join(wallpapersDir, 'missing.jpg'))
    ).rejects.toThrow()
    await expect(
      validateWallpaperFile(wallpapersDir, join(wallpapersDir, 'notes.txt'))
    ).rejects.toThrow(/JPG/)
    await expect(validateWallpaperFile(wallpapersDir, wallpapersDir)).rejects.toThrow(/file/)
  })

  it('rejects video wallpapers for static setting', async () => {
    await expect(
      validateStaticWallpaper(wallpapersDir, join(wallpapersDir, 'clip.mp4'))
    ).rejects.toThrow(/Only image/)
    expect(wallpaperTypeForPath(join(wallpapersDir, 'clip.mp4'))).toBe('video')
  })

  it('accepts an original wallpaper outside the library', async () => {
    const original = join(outsideDir, 'outside.png')
    await expect(validateOriginalWallpaper(original)).resolves.toBe(await realpath(original))
  })

  it('accepts an HTML folder with index.html inside the library', async () => {
    const folder = join(wallpapersDir, 'html-theme')
    await mkdir(folder)
    await writeFile(join(folder, 'index.html'), '<html></html>')
    await expect(validateHtmlSourceFolder(folder)).resolves.toEqual({
      folder: await realpath(folder),
      indexFile: await realpath(join(folder, 'index.html'))
    })
    await expect(validateHtmlWallpaperFolder(wallpapersDir, folder)).resolves.toEqual({
      folder: await realpath(folder),
      indexFile: await realpath(join(folder, 'index.html'))
    })
  })

  it('rejects HTML folders without index.html or outside the library', async () => {
    const missing = join(wallpapersDir, 'missing-html')
    await mkdir(missing)
    await expect(validateHtmlSourceFolder(missing)).rejects.toThrow(/index\.html/)

    const outside = join(outsideDir, 'html-theme')
    await mkdir(outside)
    await writeFile(join(outside, 'index.html'), '<html></html>')
    await expect(validateHtmlWallpaperFolder(wallpapersDir, outside)).rejects.toThrow(/outside/)
  })

  it('checks path containment without treating the base as inside itself', () => {
    expect(isPathInside(wallpapersDir, join(wallpapersDir, 'image.jpg'))).toBe(true)
    expect(isPathInside(wallpapersDir, wallpapersDir)).toBe(false)
    expect(isPathInside(wallpapersDir, join(outsideDir, 'outside.png'))).toBe(false)
  })
})
