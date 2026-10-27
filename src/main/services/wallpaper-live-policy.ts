export type WallpaperPauseReason =
  'notification' | 'fullscreen' | 'battery' | 'locked' | 'suspended' | 'user'

export interface WallpaperPauseInput {
  notificationState: number | null
  foregroundFullscreen: boolean
  onBattery: boolean
  pauseOnBattery: boolean
  locked: boolean
  suspended: boolean
  userPaused: boolean
}

export interface WallpaperPauseDecision {
  paused: boolean
  reasons: WallpaperPauseReason[]
}

export interface PointLike {
  x: number
  y: number
}

export interface BoundsLike {
  x: number
  y: number
  width: number
  height: number
}

export function shouldPauseForNotificationState(state: number | null): boolean {
  return state === 2 || state === 3 || state === 4
}

export function decideWallpaperPause(input: WallpaperPauseInput): WallpaperPauseDecision {
  const reasons: WallpaperPauseReason[] = []
  if (shouldPauseForNotificationState(input.notificationState)) {
    reasons.push('notification')
  }
  if (input.foregroundFullscreen) {
    reasons.push('fullscreen')
  }
  if (input.pauseOnBattery && input.onBattery) {
    reasons.push('battery')
  }
  if (input.locked) {
    reasons.push('locked')
  }
  if (input.suspended) {
    reasons.push('suspended')
  }
  if (input.userPaused) {
    reasons.push('user')
  }
  return { paused: reasons.length > 0, reasons }
}

export function normalizeCursorPoint(point: PointLike, bounds: BoundsLike): PointLike {
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  return {
    x: Math.min(1, Math.max(0, (point.x - bounds.x) / width)),
    y: Math.min(1, Math.max(0, (point.y - bounds.y) / height))
  }
}
