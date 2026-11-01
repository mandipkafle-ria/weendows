import { app } from 'electron'
import { join } from 'node:path'
import type { MediaSession } from 'windows-media-sessions'
import type { MediaSnapshot } from '../../shared/types'
import log from './logger'

type Listener = (snapshot: MediaSnapshot | null) => void

function text(value: string | undefined): string {
  return typeof value === 'string' ? value.trim().slice(0, 300) : ''
}

function pickSession(sessions: readonly MediaSession[]): MediaSession | null {
  let best: MediaSession | null = null
  let bestScore = -1
  for (const session of sessions) {
    const hasTitle = text(session.title) !== ''
    const playing = session.playbackStatus === 'playing'
    const paused = session.playbackStatus === 'paused'
    if (!hasTitle && !playing) {
      continue
    }
    const score = (playing ? 4 : 0) + (paused ? 2 : 0) + (hasTitle ? 1 : 0)
    if (score > bestScore) {
      best = session
      bestScore = score
    }
  }
  return best
}

function trackKey(session: MediaSession): string {
  return `${session.id}\u0000${text(session.title)}\u0000${text(session.artist)}`
}

export class MediaService {
  private readonly listeners = new Set<Listener>()
  private snapshot: MediaSnapshot | null = null
  private art: { key: string; data: string } | null = null
  private broadcastKey: string | null = null
  private stop: (() => void) | null = null
  private started = false
  private disposed = false

  start(): void {
    if (this.started || this.disposed || process.platform !== 'win32') {
      return
    }
    this.started = true
    if (app.isPackaged) {
      process.env['WINDOWS_MEDIA_SESSIONS_BACKEND'] = join(
        process.resourcesPath,
        'media',
        'windows-media-sessions-backend.exe'
      )
    }
    void import('windows-media-sessions')
      .then((mod) => {
        if (this.disposed) {
          return
        }
        this.stop = mod.onSessionsChanged((sessions) => this.update(sessions))
      })
      .catch((error: unknown) => {
        log.warn('Media session backend unavailable', error)
      })
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get(): MediaSnapshot | null {
    if (!this.snapshot) {
      return null
    }
    return { ...this.snapshot, art: this.art?.data }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.stop?.()
    this.stop = null
    if (process.platform === 'win32') {
      void import('windows-media-sessions').then((mod) => mod.shutdown()).catch(() => undefined)
    }
  }

  private update(sessions: readonly MediaSession[]): void {
    if (this.disposed) {
      return
    }
    const session = pickSession(sessions)
    if (!session) {
      this.art = null
      this.broadcastKey = null
      if (this.snapshot) {
        this.snapshot = null
        this.emit(null)
      }
      return
    }

    const key = trackKey(session)
    if (session.thumbnail && this.art?.key !== key) {
      this.art = { key, data: session.thumbnail }
    }
    const positionMs = Math.max(0, Math.round(session.timeline?.positionMs ?? 0))
    const durationMs = Math.max(0, Math.round(session.timeline?.durationMs ?? 0))
    const next: MediaSnapshot = {
      title: text(session.title),
      artist: text(session.artist),
      album: text(session.albumTitle),
      sourceApp: text(session.sourceAppDisplayName) || text(session.sourceAppUserModelId),
      playing: session.playbackStatus === 'playing',
      positionMs: durationMs > 0 ? Math.min(positionMs, durationMs) : positionMs,
      durationMs,
      at: Date.now()
    }

    const previous = this.snapshot
    const changed =
      !previous ||
      previous.title !== next.title ||
      previous.artist !== next.artist ||
      previous.album !== next.album ||
      previous.sourceApp !== next.sourceApp ||
      previous.playing !== next.playing ||
      Math.abs(previous.positionMs - next.positionMs) >= 1000 ||
      previous.durationMs !== next.durationMs

    this.snapshot = next
    if (!changed) {
      return
    }
    this.emit(this.broadcastKey === key ? next : { ...next, art: this.art?.data })
    this.broadcastKey = key
  }

  private emit(snapshot: MediaSnapshot | null): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch (error) {
        log.warn('Media listener failed', error)
      }
    }
  }
}
