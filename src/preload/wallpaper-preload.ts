import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type WallpaperHostApi } from '../shared/ipc'
import type { WallpaperHostEvent } from '../shared/types'

const api: WallpaperHostApi = {
  onEvent: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: WallpaperHostEvent): void => {
      callback(payload)
    }
    ipcRenderer.on(IPC.wallpaperHostEvent, listener)
    return () => ipcRenderer.removeListener(IPC.wallpaperHostEvent, listener)
  }
}

contextBridge.exposeInMainWorld('wallpaperApi', api)
