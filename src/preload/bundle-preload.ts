import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type BundlePopoverApi } from '../shared/ipc'
import type { BundlePopoverState } from '../shared/types'

const api: BundlePopoverApi = {
  getState: () => ipcRenderer.invoke(IPC.bundleGetState),
  rename: (name) => ipcRenderer.invoke(IPC.bundleRename, name),
  removeApp: (appId) => ipcRenderer.invoke(IPC.bundleRemoveApp, appId),
  reorder: (from, to) => ipcRenderer.invoke(IPC.bundleReorder, from, to),
  launch: (appId) => ipcRenderer.invoke(IPC.bundleLaunch, appId),
  close: () => ipcRenderer.send(IPC.bundleClose),
  onState: (callback) => {
    const listener = (_event: IpcRendererEvent, state: BundlePopoverState | null): void =>
      callback(state)
    ipcRenderer.on(IPC.bundleStateChanged, listener)
    return () => ipcRenderer.removeListener(IPC.bundleStateChanged, listener)
  }
}

contextBridge.exposeInMainWorld('bundleApi', api)
