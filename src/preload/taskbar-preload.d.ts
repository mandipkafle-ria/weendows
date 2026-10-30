import type { TaskbarApi } from '../shared/ipc'

declare global {
  interface Window {
    taskbarApi: TaskbarApi
  }
}

export {}
