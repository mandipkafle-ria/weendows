import type { WidgetPlacement } from '../../shared/types'

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect extends Point, Size {}

export interface DisplayLike {
  id: string
  bounds: Rect
  workArea: Rect
}

export function snapValue(value: number, step: number): number {
  if (step <= 0) {
    return value
  }
  return Math.round(value / step) * step
}

export function snapRect(rect: Rect, step: number): Rect {
  return {
    x: snapValue(rect.x, step),
    y: snapValue(rect.y, step),
    width: snapValue(rect.width, step),
    height: snapValue(rect.height, step)
  }
}

export function clampRect(rect: Rect, workArea: Rect, minVisible: number): Rect {
  const visibleX = Math.min(rect.width, minVisible)
  const visibleY = Math.min(rect.height, minVisible)
  const minX = workArea.x - rect.width + visibleX
  const maxX = workArea.x + workArea.width - visibleX
  const minY = workArea.y - rect.height + visibleY
  const maxY = workArea.y + workArea.height - visibleY

  return {
    x: Math.min(Math.max(rect.x, minX), maxX),
    y: Math.min(Math.max(rect.y, minY), maxY),
    width: rect.width,
    height: rect.height
  }
}

interface AxisTarget {
  start: number
  size: number
}

function nearestAxis(
  value: number,
  size: number,
  targets: AxisTarget[],
  threshold: number
): number | null {
  let best: number | null = null
  let bestDistance = threshold + 1

  for (const target of targets) {
    const candidates = [
      target.start,
      target.start + target.size - size,
      target.start + target.size,
      target.start - size
    ]
    for (const candidate of candidates) {
      const distance = Math.abs(candidate - value)
      if (distance <= threshold && distance < bestDistance) {
        best = candidate
        bestDistance = distance
      }
    }
  }

  return best
}

export function magnetize(rect: Rect, others: readonly Rect[], threshold: number): Point {
  const x = nearestAxis(
    rect.x,
    rect.width,
    others.map((other) => ({ start: other.x, size: other.width })),
    threshold
  )
  const y = nearestAxis(
    rect.y,
    rect.height,
    others.map((other) => ({ start: other.y, size: other.height })),
    threshold
  )

  return {
    x: x ?? rect.x,
    y: y ?? rect.y
  }
}

export function boundsForPlacement(placement: WidgetPlacement, display: DisplayLike): Rect {
  return {
    x: display.bounds.x + placement.x,
    y: display.bounds.y + placement.y,
    width: placement.width,
    height: placement.height
  }
}

export function placementFromBounds(
  base: WidgetPlacement,
  bounds: Rect,
  display: DisplayLike
): WidgetPlacement {
  return {
    ...base,
    displayId: display.id,
    x: Math.round(bounds.x - display.bounds.x),
    y: Math.round(bounds.y - display.bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height)
  }
}

export function clampPlacement(
  placement: WidgetPlacement,
  display: DisplayLike,
  minVisible: number
): WidgetPlacement {
  const clamped = clampRect(boundsForPlacement(placement, display), display.workArea, minVisible)
  return placementFromBounds(placement, clamped, display)
}

export function displayForPlacement(
  placement: WidgetPlacement,
  displays: readonly DisplayLike[],
  primary: DisplayLike
): DisplayLike {
  return displays.find((display) => display.id === placement.displayId) ?? primary
}

export function centerBounds(
  workArea: Rect,
  size: Size,
  offsetIndex: number,
  cascade: number
): Rect {
  const offset = offsetIndex * cascade
  return {
    x: Math.round(workArea.x + (workArea.width - size.width) / 2) + offset,
    y: Math.round(workArea.y + (workArea.height - size.height) / 2) + offset,
    width: size.width,
    height: size.height
  }
}
