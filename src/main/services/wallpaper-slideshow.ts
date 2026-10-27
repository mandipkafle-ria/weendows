export interface WallpaperSlideshowOptions {
  intervalMinutes: number
  onChange: () => void | Promise<void>
  onError?: (error: unknown) => void
  now?: () => number
}

export function nextSlideshowId(
  ids: readonly string[],
  currentId: string | null,
  shuffle: boolean,
  random: () => number = Math.random
): string | null {
  if (ids.length === 0) {
    return null
  }
  if (ids.length === 1) {
    return ids[0] ?? null
  }

  const currentIndex = currentId === null ? -1 : ids.indexOf(currentId)
  if (!shuffle) {
    return ids[(currentIndex + 1) % ids.length] ?? ids[0] ?? null
  }

  const candidates =
    currentIndex >= 0 ? ids.filter((_id, index) => index !== currentIndex) : [...ids]
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
  return candidates[index] ?? candidates[0] ?? null
}

export class WallpaperSlideshow {
  private readonly onChange: () => void | Promise<void>
  private readonly onError: ((error: unknown) => void) | undefined
  private readonly now: () => number
  private timer: ReturnType<typeof setTimeout> | null = null
  private intervalMs: number
  private lastChangeAt: number | null = null
  private running = false
  private firing = false

  constructor(options: WallpaperSlideshowOptions) {
    this.onChange = options.onChange
    this.onError = options.onError
    this.now = options.now ?? (() => Date.now())
    this.intervalMs = this.minutesToMs(options.intervalMinutes)
  }

  get dueAt(): number | null {
    return this.lastChangeAt === null ? null : this.lastChangeAt + this.intervalMs
  }

  start(lastChangeAt: number | null = null): void {
    this.running = true
    this.lastChangeAt = lastChangeAt ?? this.now()
    this.schedule()
  }

  stop(): void {
    this.running = false
    this.clearTimer()
  }

  recompute(): void {
    if (!this.running || this.firing) {
      return
    }
    this.schedule()
  }

  setLastChangeAt(value: number): void {
    this.lastChangeAt = value
    if (!this.firing) {
      this.schedule()
    }
  }

  setIntervalMinutes(minutes: number): void {
    this.intervalMs = this.minutesToMs(minutes)
    if (!this.firing) {
      this.schedule()
    }
  }

  private minutesToMs(minutes: number): number {
    return Math.max(1, Math.round(minutes)) * 60_000
  }

  private schedule(): void {
    this.clearTimer()
    if (!this.running || this.lastChangeAt === null) {
      return
    }

    const delay = Math.max(0, this.lastChangeAt + this.intervalMs - this.now())
    this.timer = setTimeout(() => {
      this.timer = null
      void this.fire()
    }, delay)
  }

  private async fire(): Promise<void> {
    if (!this.running || this.firing) {
      return
    }

    this.firing = true
    this.clearTimer()
    try {
      await this.onChange()
    } catch (error) {
      this.onError?.(error)
    } finally {
      this.lastChangeAt = this.now()
      this.firing = false
      this.schedule()
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
