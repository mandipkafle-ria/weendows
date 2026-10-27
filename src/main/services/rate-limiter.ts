import { WIDGET_CALLS_PER_SECOND, WIDGET_NET_CALLS_PER_MINUTE } from '../../shared/constants'

export interface RateLimitDecision {
  ok: boolean
  net: boolean
}

class SlidingWindow {
  private hits: number[] = []

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number
  ) {}

  canTake(): boolean {
    const now = this.now()
    this.hits = this.hits.filter((time) => now - time < this.windowMs)
    return this.hits.length < this.limit
  }

  take(): void {
    this.hits.push(this.now())
  }
}

export class WidgetRateLimiter {
  private readonly calls: SlidingWindow
  private readonly net: SlidingWindow

  constructor(now: () => number = Date.now) {
    this.calls = new SlidingWindow(WIDGET_CALLS_PER_SECOND, 1000, now)
    this.net = new SlidingWindow(WIDGET_NET_CALLS_PER_MINUTE, 60000, now)
  }

  check(isNet: boolean): RateLimitDecision {
    if (!this.calls.canTake()) {
      return { ok: false, net: false }
    }
    if (isNet && !this.net.canTake()) {
      return { ok: false, net: true }
    }
    this.calls.take()
    if (isNet) {
      this.net.take()
    }
    return { ok: true, net: isNet }
  }
}

export class WidgetRateLimitRegistry {
  private readonly limiters = new Map<string, WidgetRateLimiter>()
  private readonly now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  check(widgetId: string, isNet: boolean): RateLimitDecision {
    let limiter = this.limiters.get(widgetId)
    if (!limiter) {
      limiter = new WidgetRateLimiter(this.now)
      this.limiters.set(widgetId, limiter)
    }
    return limiter.check(isNet)
  }

  forget(widgetId: string): void {
    this.limiters.delete(widgetId)
  }
}
