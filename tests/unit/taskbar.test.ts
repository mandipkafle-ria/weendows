import { describe, expect, it } from 'vitest'
import { taskbarBoundsFor, type TaskbarDisplayLike } from '../../src/main/windows/taskbar-bounds'
import { taskbarSettingsFileSchema } from '../../src/shared/schemas'

const display: TaskbarDisplayLike = {
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 }
}

describe('taskbar bounds', () => {
  it('sits above the Windows taskbar in overlay mode', () => {
    expect(taskbarBoundsFor(display, { mode: 'overlay', position: 'bottom', height: 48 })).toEqual({
      x: 0,
      y: 992,
      width: 1920,
      height: 48
    })
  })

  it('uses the full display when replacing the Windows taskbar', () => {
    expect(taskbarBoundsFor(display, { mode: 'replace', position: 'bottom', height: 56 })).toEqual({
      x: 0,
      y: 1024,
      width: 1920,
      height: 56
    })
  })

  it('supports a top position and clamps the height', () => {
    expect(taskbarBoundsFor(display, { mode: 'overlay', position: 'top', height: 200 })).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 72
    })
  })
})

describe('taskbar settings schema', () => {
  it('fills in defaults for a new settings file', () => {
    const parsed = taskbarSettingsFileSchema.parse({ schema: 1 })
    expect(parsed).toMatchObject({
      enabled: false,
      mode: 'overlay',
      position: 'bottom',
      theme: 'dark',
      height: 48,
      items: []
    })
  })

  it('rejects invalid modes and oversized pin lists', () => {
    expect(() => taskbarSettingsFileSchema.parse({ schema: 1, mode: 'windowed' })).toThrow()
    expect(() =>
      taskbarSettingsFileSchema.parse({
        schema: 1,
        items: Array.from({ length: 33 }, (_value, index) => ({
          type: 'app',
          appId: `app-${index}`
        }))
      })
    ).toThrow()
  })
})
