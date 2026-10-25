import { randomUUID } from 'node:crypto'
import type { Notice, NoticeLevel } from '../../shared/types'

type NoticeListener = (notices: Notice[]) => void

export class NoticeService {
  private readonly notices: Notice[] = []
  private readonly listeners = new Set<NoticeListener>()

  add(level: NoticeLevel, message: string): Notice {
    const notice: Notice = {
      id: randomUUID(),
      level,
      message,
      createdAt: new Date().toISOString()
    }
    this.notices.push(notice)
    this.emit()
    return notice
  }

  list(): Notice[] {
    return this.notices.map((notice) => ({ ...notice }))
  }

  remove(id: string): void {
    const index = this.notices.findIndex((notice) => notice.id === id)
    if (index >= 0) {
      this.notices.splice(index, 1)
      this.emit()
    }
  }

  clear(): void {
    if (this.notices.length > 0) {
      this.notices.length = 0
      this.emit()
    }
  }

  onChange(listener: NoticeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const snapshot = this.list()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
