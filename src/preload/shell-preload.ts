import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('shellApi', Object.freeze({ version: 1 }))
