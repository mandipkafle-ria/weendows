import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type SettingsApi } from '../shared/ipc'

const api: SettingsApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
  nativeCheck: () => ipcRenderer.invoke(IPC.nativeCheck)
}

contextBridge.exposeInMainWorld('api', api)
