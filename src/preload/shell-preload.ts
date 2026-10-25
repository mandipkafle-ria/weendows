import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type ShellApi } from '../shared/ipc'
import type { ShellState } from '../shared/types'

const api: ShellApi = {
  getState: () => ipcRenderer.invoke(IPC.shellGetState),
  onStateChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, state: ShellState): void => callback(state)
    ipcRenderer.on(IPC.shellStateChanged, listener)
    return () => ipcRenderer.removeListener(IPC.shellStateChanged, listener)
  },
  dragStart: () => ipcRenderer.send(IPC.shellDragStart),
  dragEnd: () => ipcRenderer.send(IPC.shellDragEnd),
  resizeStart: () => ipcRenderer.send(IPC.shellResizeStart),
  resizeEnd: () => ipcRenderer.send(IPC.shellResizeEnd),
  openSettings: () => ipcRenderer.send(IPC.shellOpenSettings),
  removeWidget: () => ipcRenderer.send(IPC.shellRemove)
}

contextBridge.exposeInMainWorld('shellApi', api)
