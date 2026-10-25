import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type SettingsApi } from '../shared/ipc'
import type { Notice } from '../shared/types'

const api: SettingsApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
  nativeCheck: () => ipcRenderer.invoke(IPC.nativeCheck),
  getBuiltins: () => ipcRenderer.invoke(IPC.getBuiltins),
  getWidgets: () => ipcRenderer.invoke(IPC.getWidgets),
  addWidget: (builtinType) => ipcRenderer.invoke(IPC.addWidget, builtinType),
  removeWidget: (widgetId) => ipcRenderer.invoke(IPC.removeWidget, widgetId),
  getEditMode: () => ipcRenderer.invoke(IPC.getEditMode),
  setEditMode: (enabled) => ipcRenderer.invoke(IPC.setEditMode, enabled),
  getNotices: () => ipcRenderer.invoke(IPC.getNotices),
  onWidgetsChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.widgetsChanged, listener)
    return () => ipcRenderer.removeListener(IPC.widgetsChanged, listener)
  },
  onEditModeChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, enabled: boolean): void => callback(enabled)
    ipcRenderer.on(IPC.editModeChanged, listener)
    return () => ipcRenderer.removeListener(IPC.editModeChanged, listener)
  },
  onNoticesChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, notices: Notice[]): void => callback(notices)
    ipcRenderer.on(IPC.noticesChanged, listener)
    return () => ipcRenderer.removeListener(IPC.noticesChanged, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
