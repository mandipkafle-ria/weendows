import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type ShellApi, type ShellCommand } from '../shared/ipc'
import type { ShellState, WidgetEvent } from '../shared/types'

const SEND_CHANNELS: Partial<Record<ShellCommand, string>> = {
  'drag-start': IPC.shellDragStart,
  'drag-end': IPC.shellDragEnd,
  'resize-start': IPC.shellResizeStart,
  'resize-end': IPC.shellResizeEnd,
  'open-settings': IPC.shellOpenSettings,
  'edit-with-ai': IPC.shellEditWithAi,
  'remove-widget': IPC.shellRemove,
  'widget-unresponsive': IPC.shellWidgetUnresponsive,
  'widget-responsive': IPC.shellWidgetResponsive
}

const api: ShellApi = {
  invoke: (command, payload) => {
    if (command === 'get-state') {
      return ipcRenderer.invoke(IPC.shellGetState)
    }
    if (command === 'widget-api') {
      return ipcRenderer.invoke(IPC.widgetApi, payload)
    }

    const channel = SEND_CHANNELS[command]
    if (!channel) {
      return Promise.reject(new Error('Unknown shell command'))
    }
    ipcRenderer.send(channel)
    return Promise.resolve(undefined)
  },
  on: (callback) => {
    const stateListener = (_event: IpcRendererEvent, state: ShellState): void => {
      callback({ type: 'state', state })
    }
    const widgetListener = (_event: IpcRendererEvent, event: WidgetEvent): void => {
      callback({ type: 'widget', event })
    }
    ipcRenderer.on(IPC.shellStateChanged, stateListener)
    ipcRenderer.on(IPC.widgetEvent, widgetListener)
    return () => {
      ipcRenderer.removeListener(IPC.shellStateChanged, stateListener)
      ipcRenderer.removeListener(IPC.widgetEvent, widgetListener)
    }
  }
}

contextBridge.exposeInMainWorld('shellApi', api)
