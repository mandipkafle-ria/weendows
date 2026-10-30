import type { TaskbarSettingsFile } from '../../shared/types'

export interface TaskbarRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TaskbarDisplayLike {
  bounds: TaskbarRect
  workArea: TaskbarRect
}

export function taskbarBoundsFor(
  display: TaskbarDisplayLike,
  settings: Pick<TaskbarSettingsFile, 'mode' | 'position' | 'height'>
): TaskbarRect {
  const area = settings.mode === 'replace' ? display.bounds : display.workArea
  const height = Math.max(36, Math.min(72, Math.round(settings.height)))
  const y = settings.position === 'top' ? area.y : area.y + area.height - height
  return {
    x: area.x,
    y: Math.round(y),
    width: area.width,
    height
  }
}
