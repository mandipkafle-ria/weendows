import os from 'node:os'
import { WIDGET_STATS_MIN_CALL_MS, WIDGET_STATS_SAMPLE_MS } from '../../shared/constants'
import type { WidgetSystemStats } from '../../shared/types'

interface CpuSnapshot {
  idle: number
  total: number
}

function snapshotCpus(): CpuSnapshot {
  let idle = 0
  let total = 0
  for (const cpu of os.cpus()) {
    for (const value of Object.values(cpu.times)) {
      total += value
    }
    idle += cpu.times.idle
  }
  return { idle, total }
}

function percentBetween(previous: CpuSnapshot, current: CpuSnapshot): number {
  const idle = current.idle - previous.idle
  const total = current.total - previous.total
  if (total <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, 100 * (1 - idle / total)))
}

function currentMemory(): { usedPercent: number; totalGB: number } {
  const total = os.totalmem()
  const free = os.freemem()
  return {
    usedPercent: total > 0 ? Math.min(100, Math.max(0, ((total - free) / total) * 100)) : 0,
    totalGB: total / 1024 ** 3
  }
}

export class SystemStatsSampler {
  private previous: CpuSnapshot
  private lastSample: WidgetSystemStats
  private lastCallAt = 0
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly now: () => number = Date.now) {
    this.previous = snapshotCpus()
    this.lastSample = this.compute(0)
  }

  start(): void {
    if (this.timer) {
      return
    }
    this.timer = setInterval(() => this.refresh(), WIDGET_STATS_SAMPLE_MS)
    this.timer.unref()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getStats(): WidgetSystemStats {
    const now = this.now()
    this.start()
    if (now - this.lastCallAt >= WIDGET_STATS_MIN_CALL_MS) {
      this.refresh()
    }
    this.lastCallAt = now
    return { ...this.lastSample }
  }

  private refresh(): void {
    const next = snapshotCpus()
    const cpuPercent = percentBetween(this.previous, next)
    this.previous = next
    this.lastSample = this.compute(cpuPercent)
  }

  private compute(cpuPercent: number): WidgetSystemStats {
    const memory = currentMemory()
    return {
      cpuPercent,
      memUsedPercent: memory.usedPercent,
      memTotalGB: memory.totalGB,
      uptimeSec: os.uptime()
    }
  }
}
