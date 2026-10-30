import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type SettingsApi } from '../shared/ipc'
import type {
  Notice,
  TaskbarState,
  ThemeChangedEvent,
  WallpaperState,
  WidgetDisabledEvent
} from '../shared/types'

const api: SettingsApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
  nativeCheck: () => ipcRenderer.invoke(IPC.nativeCheck),
  getGeneralState: () => ipcRenderer.invoke(IPC.settingsGetGeneral),
  setTheme: (theme) => ipcRenderer.invoke(IPC.settingsSetTheme, theme),
  setWidgetDefaultTheme: (theme) => ipcRenderer.invoke(IPC.settingsSetWidgetDefaultTheme, theme),
  setAccent: (accent) => ipcRenderer.invoke(IPC.settingsSetAccent, accent),
  setCursorStyle: (cursorStyle) => ipcRenderer.invoke(IPC.settingsSetCursorStyle, cursorStyle),
  setCursorSystemWide: (enabled) => ipcRenderer.invoke(IPC.settingsSetCursorSystemWide, enabled),
  setCursor: (config) => ipcRenderer.invoke(IPC.settingsSetCursor, config),
  createWidgetPreview: (appearance, theme, assetWidgetId) =>
    ipcRenderer.invoke(IPC.settingsCreateWidgetPreview, appearance, theme, assetWidgetId),
  releaseWidgetPreview: (token) => ipcRenderer.invoke(IPC.settingsReleaseWidgetPreview, token),
  pickWidgetBackground: () => ipcRenderer.invoke(IPC.settingsPickWidgetBackground),
  getWidgetBackground: (widgetId) => ipcRenderer.invoke(IPC.settingsGetWidgetBackground, widgetId),
  setWidgetAppearance: (widgetId, appearance) =>
    ipcRenderer.invoke(IPC.settingsSetWidgetAppearance, widgetId, appearance),
  getPreviewStats: () => ipcRenderer.invoke(IPC.settingsGetPreviewStats),
  setHotkey: (accelerator) => ipcRenderer.invoke(IPC.settingsSetHotkey, accelerator),
  setStartWithWindows: (enabled) => ipcRenderer.invoke(IPC.settingsSetLoginItem, enabled),
  resetLayout: () => ipcRenderer.invoke(IPC.settingsResetLayout),
  openDataFolder: () => ipcRenderer.invoke(IPC.settingsOpenDataFolder),
  exportDiagnostics: () => ipcRenderer.invoke(IPC.settingsExportDiagnostics),
  startNormally: () => ipcRenderer.invoke(IPC.settingsStartNormally),
  completeOnboarding: () => ipcRenderer.invoke(IPC.settingsCompleteOnboarding),
  getLicenses: () => ipcRenderer.invoke(IPC.settingsGetLicenses),
  getBuiltins: () => ipcRenderer.invoke(IPC.getBuiltins),
  getWidgets: () => ipcRenderer.invoke(IPC.getWidgets),
  getWidgetRuntime: () => ipcRenderer.invoke(IPC.getWidgetRuntime),
  getDisplays: () => ipcRenderer.invoke(IPC.getDisplays),
  setWidgetBounds: (widgetId, bounds) => ipcRenderer.invoke(IPC.setWidgetBounds, widgetId, bounds),
  getSavedAiWidgets: () => ipcRenderer.invoke(IPC.getSavedAiWidgets),
  getWallpaperState: () => ipcRenderer.invoke(IPC.wallpaperGetState),
  addWallpapers: () => ipcRenderer.invoke(IPC.wallpaperAddFiles),
  addWallpaperFolder: () => ipcRenderer.invoke(IPC.wallpaperAddFolder),
  removeWallpaper: (wallpaperId) => ipcRenderer.invoke(IPC.wallpaperRemove, wallpaperId),
  setStaticWallpaper: (wallpaperId, fit) => ipcRenderer.invoke(IPC.wallpaperSet, wallpaperId, fit),
  setLiveWallpaper: (wallpaperId, fit) =>
    ipcRenderer.invoke(IPC.wallpaperSetLive, wallpaperId, fit),
  setWallpaperInteractive: (wallpaperId, interactive) =>
    ipcRenderer.invoke(IPC.wallpaperSetInteractive, wallpaperId, interactive),
  setWallpaperLiveOptions: (options) => ipcRenderer.invoke(IPC.wallpaperSetLiveOptions, options),
  setWallpaperSlideshow: (settings) => ipcRenderer.invoke(IPC.wallpaperSlideshow, settings),
  restoreOriginalWallpaper: () => ipcRenderer.invoke(IPC.wallpaperRestore),
  addWidget: (builtinType, variant, appearance) =>
    ipcRenderer.invoke(IPC.addWidget, builtinType, variant, appearance),
  addAiWidgetCopy: (widgetId) => ipcRenderer.invoke(IPC.addAiWidgetCopy, widgetId),
  duplicateWidget: (widgetId) => ipcRenderer.invoke(IPC.duplicateWidget, widgetId),
  removeWidget: (widgetId, confirmed) => ipcRenderer.invoke(IPC.removeWidget, widgetId, confirmed),
  deleteAiWidget: (widgetId, confirmed) =>
    ipcRenderer.invoke(IPC.deleteAiWidget, widgetId, confirmed),
  setWidgetEnabled: (widgetId, enabled) =>
    ipcRenderer.invoke(IPC.setWidgetEnabled, widgetId, enabled),
  setWidgetLocked: (widgetId, locked) => ipcRenderer.invoke(IPC.setWidgetLocked, widgetId, locked),
  setWidgetOpacity: (widgetId, opacity) =>
    ipcRenderer.invoke(IPC.setWidgetOpacity, widgetId, opacity),
  setWidgetVariant: (widgetId, variant) =>
    ipcRenderer.invoke(IPC.setWidgetVariant, widgetId, variant),
  reloadWidget: (widgetId) => ipcRenderer.invoke(IPC.reloadWidget, widgetId),
  getTaskbarState: () => ipcRenderer.invoke(IPC.taskbarGetState),
  updateTaskbar: (patch) => ipcRenderer.invoke(IPC.taskbarUpdate, patch),
  onTaskbarChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, state: TaskbarState): void => callback(state)
    ipcRenderer.on(IPC.taskbarChanged, listener)
    return () => ipcRenderer.removeListener(IPC.taskbarChanged, listener)
  },
  getAppsAndBundles: () => ipcRenderer.invoke(IPC.appsGetState),
  refreshApps: () => ipcRenderer.invoke(IPC.appsRefresh),
  addAppToHomescreen: (appId, targetWidgetId) =>
    ipcRenderer.invoke(IPC.appAddToHomescreen, appId, targetWidgetId),
  createBundle: (name, appIds, targetWidgetId) =>
    ipcRenderer.invoke(IPC.bundleCreate, name, appIds, targetWidgetId),
  addBundleToHomescreen: (bundleId, targetWidgetId) =>
    ipcRenderer.invoke(IPC.bundleAddToHomescreen, bundleId, targetWidgetId),
  deleteBundle: (bundleId) => ipcRenderer.invoke(IPC.bundleDelete, bundleId),
  setWidgetPermission: (widgetId, permission, granted) =>
    ipcRenderer.invoke(IPC.setWidgetPermission, widgetId, permission, granted),
  getEditMode: () => ipcRenderer.invoke(IPC.getEditMode),
  setEditMode: (enabled) => ipcRenderer.invoke(IPC.setEditMode, enabled),
  getNotices: () => ipcRenderer.invoke(IPC.getNotices),
  dismissNotice: (noticeId) => ipcRenderer.invoke(IPC.dismissNotice, noticeId),
  clearNotices: () => ipcRenderer.invoke(IPC.clearNotices),
  onWidgetDisabled: (callback) => {
    const listener = (_event: IpcRendererEvent, info: WidgetDisabledEvent): void => callback(info)
    ipcRenderer.on(IPC.widgetDisabled, listener)
    return () => ipcRenderer.removeListener(IPC.widgetDisabled, listener)
  },
  getAiConfig: () => ipcRenderer.invoke(IPC.aiGetConfig),
  saveAiSettings: (settings) => ipcRenderer.invoke(IPC.aiSaveSettings, settings),
  saveAiKey: (provider, key) => ipcRenderer.invoke(IPC.aiSaveKey, provider, key),
  removeAiKey: () => ipcRenderer.invoke(IPC.aiRemoveKey),
  listAiModels: () => ipcRenderer.invoke(IPC.aiListModels),
  testAiConnection: () => ipcRenderer.invoke(IPC.aiTestConnection),
  generateAiWidget: (prompt) => ipcRenderer.invoke(IPC.aiGenerate, prompt),
  reviseAiWidget: (widgetId, instruction) =>
    ipcRenderer.invoke(IPC.aiRevise, widgetId, instruction),
  cancelAi: () => ipcRenderer.invoke(IPC.aiCancel),
  repairAiWidget: () => ipcRenderer.invoke(IPC.aiRepair),
  getAiPreviewLogs: () => ipcRenderer.invoke(IPC.aiGetPreviewLogs),
  closeAiPreview: () => ipcRenderer.invoke(IPC.aiClosePreview),
  approveAndSaveAiWidget: (approval) => ipcRenderer.invoke(IPC.aiApproveSave, approval),
  getAiWidgetSource: (widgetId) => ipcRenderer.invoke(IPC.aiGetWidgetSource, widgetId),
  undoAiWidget: (widgetId) => ipcRenderer.invoke(IPC.aiUndoWidget, widgetId),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  onWidgetsChanged: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.widgetsChanged, listener)
    return () => ipcRenderer.removeListener(IPC.widgetsChanged, listener)
  },
  onWallpaperChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, state: WallpaperState): void => callback(state)
    ipcRenderer.on(IPC.wallpaperChanged, listener)
    return () => ipcRenderer.removeListener(IPC.wallpaperChanged, listener)
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
  },
  onThemeChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, theme: ThemeChangedEvent): void => callback(theme)
    ipcRenderer.on(IPC.settingsThemeChanged, listener)
    return () => ipcRenderer.removeListener(IPC.settingsThemeChanged, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
