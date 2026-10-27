import { app } from 'electron'
import log from './logger'

const SAMPLE_INTERVAL_MS = 60_000

export class MetricsLogger {
  private timer: NodeJS.Timeout | null = null

  start(): void {
    if (process.env['HL_DEBUG_METRICS'] !== '1' || this.timer) {
      return
    }
    log.info('Performance metrics logging enabled (HL_DEBUG_METRICS=1)')
    this.timer = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private sample(): void {
    const metrics = app.getAppMetrics()
    const cpu = metrics.reduce((sum, processMetric) => sum + processMetric.cpu.percentCPUUsage, 0)
    const ramMB =
      metrics.reduce((sum, processMetric) => sum + processMetric.memory.workingSetSize, 0) / 1024
    log.info(`metrics processes=${metrics.length} cpu=${cpu.toFixed(1)}% ram=${ramMB.toFixed(0)}MB`)
  }
}
