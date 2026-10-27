import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parseByteRange,
  resolveWallpaperMedia,
  resolveWallpaperThumbnail
} from '../../src/main/protocol/wallpaper-protocol'

const wallpapersDir = resolve('test-wallpapers')

describe('wallpaper media URLs', () => {
  it('maps a media URL to a video inside the wallpaper library', () => {
    expect(resolveWallpaperMedia(wallpapersDir, 'hl-wallpaper://media/aurora/clip.mp4')).toEqual({
      file: join(wallpapersDir, 'aurora', 'clip.mp4'),
      mime: 'video/mp4'
    })
    expect(resolveWallpaperMedia(wallpapersDir, 'hl-wallpaper://media/aurora/loop.webm')).toEqual({
      file: join(wallpapersDir, 'aurora', 'loop.webm'),
      mime: 'video/webm'
    })
  })

  it('rejects traversal, nested paths, unknown types, and non-media hosts', () => {
    expect(
      resolveWallpaperMedia(wallpapersDir, 'hl-wallpaper://media/aurora/..%2Fsecret.mp4')
    ).toBeNull()
    expect(
      resolveWallpaperMedia(wallpapersDir, 'hl-wallpaper://media/aurora/nested/clip.mp4')
    ).toBeNull()
    expect(resolveWallpaperMedia(wallpapersDir, 'hl-wallpaper://media/aurora/notes.txt')).toBeNull()
    expect(resolveWallpaperMedia(wallpapersDir, 'hl-wallpaper://thumb/aurora')).toBeNull()
    expect(resolveWallpaperMedia(wallpapersDir, 'widget://media/aurora/clip.mp4')).toBeNull()
  })

  it('keeps the thumbnail URL mapping', () => {
    expect(resolveWallpaperThumbnail(wallpapersDir, 'hl-wallpaper://thumb/aurora')).toBe(
      join(wallpapersDir, 'thumbs', 'aurora.png')
    )
    expect(resolveWallpaperThumbnail(wallpapersDir, 'hl-wallpaper://thumb/bad_id')).toBeNull()
  })
})

describe('parseByteRange', () => {
  it('parses bounded, open-ended, and suffix ranges', () => {
    expect(parseByteRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(parseByteRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseByteRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseByteRange('bytes=0-9999', 1000)).toEqual({ start: 0, end: 999 })
    expect(parseByteRange(null, 1000)).toBeNull()
  })

  it('rejects unsatisfiable and malformed ranges', () => {
    expect(parseByteRange('bytes=1000-', 1000)).toBe('invalid')
    expect(parseByteRange('bytes=5-4', 1000)).toBe('invalid')
    expect(parseByteRange('bytes=abc', 1000)).toBe('invalid')
    expect(parseByteRange('bytes=-0', 1000)).toBe('invalid')
    expect(parseByteRange('bytes=0-1,3-4', 1000)).toBe('invalid')
    expect(parseByteRange('bytes=0-0', 0)).toBe('invalid')
  })
})
