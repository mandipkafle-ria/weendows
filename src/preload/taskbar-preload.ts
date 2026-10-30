import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type TaskbarApi } from '../shared/ipc'
import type { TaskbarState } from '../shared/types'

const api: TaskbarApi = {
  getState: () => ipcRenderer.invoke(IPC.taskbarGetState),
  launchApp: (appId) => ipcRenderer.invoke(IPC.taskbarLaunchApp, appId),
  openBundle: (bundleId, anchor) => ipcRenderer.invoke(IPC.taskbarOpenBundle, bundleId, anchor),
  openSettings: () => {
    void ipcRenderer.invoke(IPC.taskbarOpenSettings)
  },
  onState: (callback) => {
    const listener = (_event: IpcRendererEvent, state: TaskbarState): void => {
      callback(state)
    }
    ipcRenderer.on(IPC.taskbarChanged, listener)
    return () => ipcRenderer.removeListener(IPC.taskbarChanged, listener)
  }
}

contextBridge.exposeInMainWorld('taskbarApi', api)
