import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type BadgeAction, type BadgeApi } from '../shared/ipc'

const api: BadgeApi = {
  action: (action: BadgeAction) => ipcRenderer.send(IPC.badgeAction, action)
}

contextBridge.exposeInMainWorld('badgeApi', api)
