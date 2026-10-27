import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCursorFile, type CursorFileImage } from '../../src/main/native/cursor-file'
import { SystemCursorService, type SystemCursorBackend } from '../../src/main/native/system-cursor'

const tempDirs: string[] = []

async function makeCursorDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'homelayer-cursors-'))
  tempDirs.push(dir)
  await Promise.all([
    writeFile(join(dir, 'dot.cur'), 'dot'),
    writeFile(join(dir, 'neon.cur'), 'neon'),
    writeFile(join(dir, 'pixel.cur'), 'pixel')
  ])
  return dir
}

function image(overrides: Partial<CursorFileImage> = {}): CursorFileImage {
  return {
    png: Buffer.from('png'),
    width: 32,
    height: 32,
    hotspotX: 3,
    hotspotY: 2,
    ...overrides
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('buildCursorFile', () => {
  it('writes a multi-image Windows cursor file', () => {
    const first = image()
    const second = image({
      png: Buffer.from('second-image'),
      width: 256,
      height: 256,
      hotspotX: 10,
      hotspotY: 12
    })

    const cursor = buildCursorFile([first, second])

    expect(cursor.readUInt16LE(0)).toBe(0)
    expect(cursor.readUInt16LE(2)).toBe(2)
    expect(cursor.readUInt16LE(4)).toBe(2)
    expect(cursor[6]).toBe(32)
    expect(cursor[7]).toBe(32)
    expect(cursor.readUInt16LE(10)).toBe(3)
    expect(cursor.readUInt16LE(12)).toBe(2)
    expect(cursor.readUInt32LE(14)).toBe(first.png.length)
    expect(cursor.readUInt32LE(18)).toBe(38)
    expect(cursor[22]).toBe(0)
    expect(cursor[23]).toBe(0)
    expect(cursor.readUInt16LE(26)).toBe(10)
    expect(cursor.readUInt16LE(28)).toBe(12)
    expect(cursor.readUInt32LE(30)).toBe(second.png.length)
    expect(cursor.readUInt32LE(34)).toBe(38 + first.png.length)
    expect(cursor.subarray(38, 41).toString()).toBe('png')
    expect(cursor.subarray(41).toString()).toBe('second-image')
  })

  it('rejects invalid images', () => {
    expect(() => buildCursorFile([])).toThrow('needs between 1 and 65535 images')
    expect(() => buildCursorFile([image({ width: 0 })])).toThrow('between 1 and 256 pixels')
    expect(() => buildCursorFile([image({ hotspotX: 32 })])).toThrow('hotspots must be inside')
    expect(() => buildCursorFile([image({ png: Buffer.alloc(0) })])).toThrow('cannot be empty')
  })
})

describe('SystemCursorService', () => {
  it('applies, switches, and restores cursor packs', async () => {
    const cursorDir = await makeCursorDir()
    const replace = vi.fn()
    const restore = vi.fn()
    const backend: SystemCursorBackend = { replace, restore }
    const service = new SystemCursorService({ cursorDir, backend })

    service.apply('dot')
    service.apply('dot')
    service.apply('neon')
    service.restore()
    service.restore()
    service.apply('pixel')
    service.apply('system')

    expect(replace.mock.calls.map(([file]) => basename(file))).toEqual([
      'dot.cur',
      'neon.cur',
      'pixel.cur'
    ])
    expect(restore).toHaveBeenCalledTimes(2)
  })

  it('syncs the enabled state', async () => {
    const cursorDir = await makeCursorDir()
    const backend: SystemCursorBackend = { replace: vi.fn(), restore: vi.fn() }
    const service = new SystemCursorService({ cursorDir, backend })

    service.sync('dot', false)
    expect(backend.replace).not.toHaveBeenCalled()

    service.sync('dot', true)
    expect(backend.replace).toHaveBeenCalledTimes(1)

    service.sync('neon', false)
    expect(backend.restore).toHaveBeenCalledTimes(1)
  })

  it('rejects missing files and unavailable backends', async () => {
    const cursorDir = await makeCursorDir()
    const service = new SystemCursorService({
      cursorDir,
      backend: { replace: vi.fn(), restore: vi.fn() }
    })

    expect(() => service.apply('dot')).not.toThrow()
    await rm(join(cursorDir, 'neon.cur'))

    expect(() => service.apply('neon')).toThrow('neon cursor file is missing')

    const unavailable = new SystemCursorService({ cursorDir, backend: null })
    expect(() => unavailable.apply('dot')).toThrow('unavailable')
  })
})
