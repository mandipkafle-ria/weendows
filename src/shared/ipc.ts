import type {
  AccentColor,
  AiApproval,
  AiConfig,
  AiGenerateResult,
  AiSaveResult,
  AiSettings,
  AiTestResult,
  AiWidgetSource,
  AppsAndBundlesState,
  AppGridState,
  BuiltinWidget,
  CursorConfig,
  CursorStyle,
  BundlePopoverResult,
  BundlePopoverState,
  DiagnosticsExport,
  DesktopDisplayInfo,
  GeneralState,
  Notice,
  ShellState,
  TaskbarAnchor,
  TaskbarSettingsPatch,
  TaskbarState,
  ThemeChangedEvent,
  ThemeSource,
  WidgetEvent,
  WallpaperFit,
  WallpaperHostEvent,
  WallpaperLiveOptions,
  WallpaperSlideshowSettings,
  WallpaperState,
  WidgetLogEntry,
  WidgetManifest,
  WidgetPermission,
  WidgetAppearance,
  WidgetBoundsPatch,
  WidgetDisabledEvent,
  WidgetRuntimeInfo,
  WidgetSummary,
  WidgetSystemStats
} from './types'

export const IPC = {
  getAppInfo: 'app:get-info',
  nativeCheck: 'native:check',
  settingsGetGeneral: 'settings:get-general',
  settingsSetTheme: 'settings:set-theme',
  settingsSetWidgetDefaultTheme: 'settings:set-widget-default-theme',
  settingsSetCursor: 'settings:set-cursor',
  settingsCreateWidgetPreview: 'settings:create-widget-preview',
  settingsReleaseWidgetPreview: 'settings:release-widget-preview',
  settingsPickWidgetBackground: 'settings:pick-widget-background',
  settingsGetWidgetBackground: 'settings:get-widget-background',
  settingsSetWidgetAppearance: 'settings:set-widget-appearance',
  settingsSetAccent: 'settings:set-accent',
  settingsSetCursorStyle: 'settings:set-cursor-style',
  settingsSetCursorSystemWide: 'settings:set-cursor-system-wide',
  settingsGetPreviewStats: 'settings:get-preview-stats',
  settingsSetHotkey: 'settings:set-hotkey',
  settingsSetLoginItem: 'settings:set-login-item',
  settingsResetLayout: 'settings:reset-layout',
  settingsOpenDataFolder: 'settings:open-data-folder',
  settingsExportDiagnostics: 'settings:export-diagnostics',
  settingsStartNormally: 'settings:start-normally',
  settingsCompleteOnboarding: 'settings:complete-onboarding',
  settingsGetLicenses: 'settings:get-licenses',
  settingsThemeChanged: 'settings:theme-changed',
  getBuiltins: 'widgets:get-builtins',
  getWidgets: 'widgets:get-all',
  getWidgetRuntime: 'widgets:get-runtime',
  getDisplays: 'layout:get-displays',
  setWidgetBounds: 'layout:set-widget-bounds',
  getSavedAiWidgets: 'widgets:get-saved-ai',
  addWidget: 'widgets:add',
  addAiWidgetCopy: 'widgets:add-ai-copy',
  duplicateWidget: 'widgets:duplicate',
  removeWidget: 'widgets:remove',
  deleteAiWidget: 'widgets:delete-ai',
  setWidgetEnabled: 'widgets:set-enabled',
  setWidgetLocked: 'widgets:set-locked',
  setWidgetOpacity: 'widgets:set-opacity',
  setWidgetVariant: 'widgets:set-variant',
  reloadWidget: 'widgets:reload',
  setWidgetPermission: 'widgets:set-permission',
  widgetsChanged: 'widgets:changed',
  getEditMode: 'layout:get-edit-mode',
  setEditMode: 'layout:set-edit-mode',
  editModeChanged: 'layout:edit-mode-changed',
  getNotices: 'notices:get',
  noticesChanged: 'notices:changed',
  dismissNotice: 'notices:dismiss',
  clearNotices: 'notices:clear',
  widgetDisabled: 'widgets:disabled',
  shellGetState: 'shell:get-state',
  shellStateChanged: 'shell:state-changed',
  shellDragStart: 'shell:drag-start',
  shellDragEnd: 'shell:drag-end',
  shellResizeStart: 'shell:resize-start',
  shellResizeEnd: 'shell:resize-end',
  shellOpenSettings: 'shell:open-settings',
  shellRemove: 'shell:remove',
  shellWidgetUnresponsive: 'shell:widget-unresponsive',
  shellWidgetResponsive: 'shell:widget-responsive',
  widgetApi: 'widget:api',
  widgetEvent: 'widget:event',
  badgeAction: 'badge:action',
  shellEditWithAi: 'shell:edit-with-ai',
  aiGetConfig: 'ai:get-config',
  aiSaveSettings: 'ai:save-settings',
  aiSaveKey: 'ai:save-key',
  aiRemoveKey: 'ai:remove-key',
  aiListModels: 'ai:list-models',
  aiTestConnection: 'ai:test-connection',
  aiGenerate: 'ai:generate',
  aiRevise: 'ai:revise',
  aiCancel: 'ai:cancel',
  aiRepair: 'ai:repair',
  aiGetPreviewLogs: 'ai:get-preview-logs',
  aiClosePreview: 'ai:close-preview',
  aiApproveSave: 'ai:approve-save',
  aiGetWidgetSource: 'ai:get-widget-source',
  aiUndoWidget: 'ai:undo-widget',
  appsRefresh: 'apps:refresh',
  appsGetState: 'apps:get-state',
  appAddToHomescreen: 'apps:add-to-homescreen',
  bundleCreate: 'bundle:create',
  bundleAddToHomescreen: 'bundle:add-to-homescreen',
  bundleDelete: 'bundle:delete',
  gridGetState: 'grid:get-state',
  gridAddApps: 'grid:add-apps',
  gridRemoveApp: 'grid:remove-app',
  gridMoveItem: 'grid:move-item',
  gridMergeApp: 'grid:merge-app',
  gridOpenBundle: 'grid:open-bundle',
  bundleGetState: 'bundle:get-state',
  bundleRename: 'bundle:rename',
  bundleRemoveApp: 'bundle:remove-app',
  bundleReorder: 'bundle:reorder',
  bundleLaunch: 'bundle:launch',
  bundleClose: 'bundle:close',
  bundleStateChanged: 'bundle:state-changed',
  wallpaperGetState: 'wallpaper:get-state',
  wallpaperAddFiles: 'wallpaper:add-files',
  wallpaperAddFolder: 'wallpaper:add-folder',
  wallpaperRemove: 'wallpaper:remove',
  wallpaperSet: 'wallpaper:set',
  wallpaperSetLive: 'wallpaper:set-live',
  wallpaperSetInteractive: 'wallpaper:set-interactive',
  wallpaperSetLiveOptions: 'wallpaper:set-live-options',
  wallpaperSlideshow: 'wallpaper:slideshow',
  wallpaperRestore: 'wallpaper:restore',
  wallpaperChanged: 'wallpaper:changed',
  wallpaperHostEvent: 'wallpaper:host-event',
  taskbarGetState: 'taskbar:get-state',
  taskbarUpdate: 'taskbar:update',
  taskbarLaunchApp: 'taskbar:launch-app',
  taskbarOpenBundle: 'taskbar:open-bundle',
  taskbarOpenSettings: 'taskbar:open-settings',
  taskbarChanged: 'taskbar:changed',
  openExternal: 'app:open-external'
} as const

export type ShellCommand =
  | 'get-state'
  | 'drag-start'
  | 'drag-end'
  | 'resize-start'
  | 'resize-end'
  | 'open-settings'
  | 'edit-with-ai'
  | 'remove-widget'
  | 'widget-unresponsive'
  | 'widget-responsive'
  | 'widget-api'

export type ShellEvent =
  { type: 'state'; state: ShellState } | { type: 'widget'; event: WidgetEvent }

export type BadgeAction = 'reload' | 'disable'

export interface BadgeApi {
  action: (action: BadgeAction) => void
}

export interface AppInfo {
  version: string
  platform: string
  arch: string
}

export interface NativeCheckSuccess {
  ok: true
  tickCount: number
  progmanHandle: string | null
}

export interface NativeCheckFailure {
  ok: false
  error: string
}

export type NativeCheckResult = NativeCheckSuccess | NativeCheckFailure

export interface SettingsApi {
  getAppInfo: () => Promise<AppInfo>
  nativeCheck: () => Promise<NativeCheckResult>
  getGeneralState: () => Promise<GeneralState>
  setTheme: (theme: ThemeSource) => Promise<GeneralState>
  setWidgetDefaultTheme: (theme: ThemeSource) => Promise<GeneralState>
  setAccent: (accent: AccentColor) => Promise<GeneralState>
  setCursorStyle: (cursorStyle: CursorStyle) => Promise<GeneralState>
  setCursorSystemWide: (enabled: boolean) => Promise<GeneralState>
  setCursor: (config: Partial<CursorConfig>) => Promise<GeneralState>
  createWidgetPreview: (
    appearance: WidgetAppearance,
    theme: 'dark' | 'light',
    assetWidgetId?: string
  ) => Promise<string>
  releaseWidgetPreview: (token: string) => Promise<void>
  pickWidgetBackground: () => Promise<{ dataUrl: string; name: string } | null>
  getWidgetBackground: (widgetId: string) => Promise<string | null>
  setWidgetAppearance: (
    widgetId: string,
    appearance: Partial<WidgetAppearance>
  ) => Promise<WidgetSummary | null>
  getPreviewStats: () => Promise<WidgetSystemStats>
  setHotkey: (accelerator: string) => Promise<GeneralState>
  setStartWithWindows: (enabled: boolean) => Promise<GeneralState>
  resetLayout: () => Promise<boolean>
  openDataFolder: () => Promise<void>
  exportDiagnostics: () => Promise<DiagnosticsExport>
  startNormally: () => Promise<void>
  completeOnboarding: () => Promise<GeneralState>
  getLicenses: () => Promise<string>
  getBuiltins: () => Promise<BuiltinWidget[]>
  getWidgets: () => Promise<WidgetSummary[]>
  getWidgetRuntime: () => Promise<WidgetRuntimeInfo[]>
  getDisplays: () => Promise<DesktopDisplayInfo[]>
  setWidgetBounds: (widgetId: string, bounds: WidgetBoundsPatch) => Promise<WidgetSummary | null>
  getSavedAiWidgets: () => Promise<WidgetManifest[]>
  getWallpaperState: () => Promise<WallpaperState>
  addWallpapers: () => Promise<WallpaperState>
  addWallpaperFolder: () => Promise<WallpaperState>
  removeWallpaper: (wallpaperId: string) => Promise<WallpaperState>
  setStaticWallpaper: (wallpaperId: string, fit: WallpaperFit) => Promise<WallpaperState>
  setLiveWallpaper: (wallpaperId: string, fit: WallpaperFit) => Promise<WallpaperState>
  setWallpaperInteractive: (wallpaperId: string, interactive: boolean) => Promise<WallpaperState>
  setWallpaperLiveOptions: (options: WallpaperLiveOptions) => Promise<WallpaperState>
  setWallpaperSlideshow: (settings: WallpaperSlideshowSettings) => Promise<WallpaperState>
  restoreOriginalWallpaper: () => Promise<WallpaperState>
  addWidget: (
    builtinType: string,
    variant?: string,
    appearance?: Partial<WidgetAppearance>
  ) => Promise<WidgetSummary>
  addAiWidgetCopy: (widgetId: string) => Promise<WidgetSummary>
  duplicateWidget: (widgetId: string) => Promise<WidgetSummary>
  removeWidget: (widgetId: string, confirmed?: boolean) => Promise<boolean>
  deleteAiWidget: (widgetId: string, confirmed?: boolean) => Promise<boolean>
  setWidgetEnabled: (widgetId: string, enabled: boolean) => Promise<WidgetSummary | null>
  setWidgetLocked: (widgetId: string, locked: boolean) => Promise<boolean>
  setWidgetOpacity: (widgetId: string, opacity: number) => Promise<boolean>
  setWidgetVariant: (widgetId: string, variant: string) => Promise<WidgetSummary | null>
  reloadWidget: (widgetId: string) => Promise<void>
  getTaskbarState: () => Promise<TaskbarState>
  updateTaskbar: (patch: TaskbarSettingsPatch) => Promise<TaskbarState>
  onTaskbarChanged: (callback: (state: TaskbarState) => void) => () => void
  getAppsAndBundles: () => Promise<AppsAndBundlesState>
  refreshApps: () => Promise<AppsAndBundlesState>
  addAppToHomescreen: (
    appId: string,
    targetWidgetId?: string
  ) => Promise<{ success: boolean; widgetId: string }>
  createBundle: (
    name: string,
    appIds: string[],
    targetWidgetId?: string | boolean
  ) => Promise<AppsAndBundlesState>
  addBundleToHomescreen: (
    bundleId: string,
    targetWidgetId?: string
  ) => Promise<{ success: boolean; widgetId: string }>
  deleteBundle: (bundleId: string) => Promise<AppsAndBundlesState>
  setWidgetPermission: (
    widgetId: string,
    permission: WidgetPermission,
    granted: boolean
  ) => Promise<WidgetSummary>
  getEditMode: () => Promise<boolean>
  setEditMode: (enabled: boolean) => Promise<boolean>
  getNotices: () => Promise<Notice[]>
  dismissNotice: (noticeId: string) => Promise<void>
  clearNotices: () => Promise<void>
  onWidgetDisabled: (callback: (event: WidgetDisabledEvent) => void) => () => void
  getAiConfig: () => Promise<AiConfig>
  saveAiSettings: (settings: AiSettings) => Promise<AiConfig>
  saveAiKey: (provider: AiConfig['provider'], key: string) => Promise<AiConfig>
  removeAiKey: () => Promise<AiConfig>
  listAiModels: () => Promise<string[]>
  testAiConnection: () => Promise<AiTestResult>
  generateAiWidget: (prompt: string) => Promise<AiGenerateResult>
  reviseAiWidget: (widgetId: string, instruction: string) => Promise<AiGenerateResult>
  cancelAi: () => Promise<void>
  repairAiWidget: () => Promise<AiGenerateResult>
  getAiPreviewLogs: () => Promise<WidgetLogEntry[]>
  closeAiPreview: () => Promise<void>
  approveAndSaveAiWidget: (approval: AiApproval) => Promise<AiSaveResult>
  getAiWidgetSource: (widgetId: string) => Promise<AiWidgetSource>
  undoAiWidget: (widgetId: string) => Promise<AiSaveResult>
  openExternal: (url: string) => Promise<void>
  onWidgetsChanged: (callback: () => void) => () => void
  onWallpaperChanged: (callback: (state: WallpaperState) => void) => () => void
  onEditModeChanged: (callback: (enabled: boolean) => void) => () => void
  onNoticesChanged: (callback: (notices: Notice[]) => void) => () => void
  onThemeChanged: (callback: (event: ThemeChangedEvent) => void) => () => void
}

export interface ShellApi {
  invoke: (command: ShellCommand, payload?: unknown) => Promise<unknown>
  on: (callback: (event: ShellEvent) => void) => () => void
}

export interface WallpaperHostApi {
  onEvent: (callback: (event: WallpaperHostEvent) => void) => () => void
}

export interface TaskbarApi {
  getState: () => Promise<TaskbarState>
  launchApp: (appId: string) => Promise<void>
  openBundle: (bundleId: string, anchor: TaskbarAnchor) => Promise<void>
  openSettings: () => void
  onState: (callback: (state: TaskbarState) => void) => () => void
}

export interface BundlePopoverApi {
  getState: () => Promise<BundlePopoverState | null>
  rename: (name: string) => Promise<BundlePopoverResult>
  removeApp: (appId: string) => Promise<BundlePopoverResult>
  reorder: (from: number, to: number) => Promise<BundlePopoverResult>
  launch: (appId: string) => Promise<void>
  close: () => void
  onState: (callback: (state: BundlePopoverState | null) => void) => () => void
}

export type { AppGridState }
