export const WIDGET_PERMISSIONS = [
  'system.stats',
  'system.battery',
  'storage',
  'network',
  'launch',
  'openLink'
] as const

export type WidgetPermission = (typeof WIDGET_PERMISSIONS)[number]

export type WidgetKind = 'builtin' | 'ai' | 'imported'

export const WIDGET_CATEGORIES = ['time', 'focus', 'system', 'ambient', 'apps'] as const
export type WidgetCategory = (typeof WIDGET_CATEGORIES)[number]

export const ACCENT_COLORS = ['ember', 'violet', 'teal', 'rose'] as const
export type AccentColor = (typeof ACCENT_COLORS)[number]

export const CURSOR_STYLES = [
  'system',
  'dot',
  'neon',
  'pixel',
  'ring',
  'crosshair',
  'arrow'
] as const
export type CursorStyle = (typeof CURSOR_STYLES)[number]
export const SYSTEM_CURSOR_STYLES = ['system', 'dot', 'neon', 'pixel'] as const

export const CURSOR_CLICK_ANIMATIONS = ['ripple', 'burst', 'none'] as const
export type CursorClickAnimation = (typeof CURSOR_CLICK_ANIMATIONS)[number]

export interface CursorConfig {
  style: CursorStyle
  color: string
  size: number
  opacity: number
  glowIntensity: number
  clickAnimation: CursorClickAnimation
  systemWide: boolean
}

export const WIDGET_BG_STYLES = ['solid', 'blur', 'transparent'] as const
export type WidgetBgStyle = (typeof WIDGET_BG_STYLES)[number]

export const WIDGET_BG_IMAGE_FITS = ['cover', 'contain', 'tile'] as const
export type WidgetBgImageFit = (typeof WIDGET_BG_IMAGE_FITS)[number]

export interface WidgetAppearance {
  themeOverride: 'dark' | 'light' | null
  bgColor: string | null
  bgOpacity: number
  bgBlur: number
  bgStyle: WidgetBgStyle
  bgImage: string | null
  bgImageFit: WidgetBgImageFit
  cornerRadius: number
  borderOpacity: number
  borderColor: string | null
  contentOpacity: number
}

export interface WidgetVariant {
  id: string
  width: number
  height: number
  minWidth: number
  minHeight: number
  tags?: string[]
}

export interface WidgetManifest {
  schema: 1
  id: string
  name: string
  kind: WidgetKind
  builtinType?: string
  variant?: string
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  focusable?: boolean
  editPassthrough?: boolean
  permissions: WidgetPermission[]
  grantedPermissions: WidgetPermission[]
  allowedHosts: string[]
  prompt?: string
  createdAt: string
  updatedAt: string
}

export interface WidgetPlacement extends WidgetAppearance {
  widgetId: string
  displayId: string
  x: number
  y: number
  width: number
  height: number
  zOrder: number
  locked: boolean
  enabled: boolean
  opacity: number
}

export interface LayoutFile {
  schema: 1
  placements: WidgetPlacement[]
}

export interface BuiltinWidget {
  type: string
  name: string
  description: string
  category: WidgetCategory
  width: number
  height: number
  minWidth: number
  minHeight: number
  variants: WidgetVariant[]
  focusable?: boolean
  editPassthrough?: boolean
  permissions?: WidgetPermission[]
  allowedHosts?: string[]
}

export interface WidgetSummary {
  manifest: WidgetManifest
  placement: WidgetPlacement
}

export type ThemeSource = 'dark' | 'light' | 'system'

export interface AppSettingsFile {
  schema: 1
  theme: ThemeSource
  widgetDefaultTheme: ThemeSource
  accent: AccentColor
  cursorStyle: CursorStyle
  cursorSystemWide: boolean
  cursorColor: string
  cursorSize: number
  cursorOpacity: number
  cursorGlow: number
  cursorClickAnimation: CursorClickAnimation
  hotkey: string
  window: {
    width: number
    height: number
  }
  onboardingCompleted: boolean
}

export type SafeModeReason = 'flag' | 'crashes' | null

export interface GeneralState {
  version: string
  platform: string
  arch: string
  theme: ThemeSource
  resolvedTheme: 'dark' | 'light'
  widgetDefaultTheme: ThemeSource
  resolvedWidgetTheme: 'dark' | 'light'
  accent: AccentColor
  cursor: CursorConfig
  hotkey: string
  loginItemAvailable: boolean
  loginItemEnabled: boolean
  safeMode: boolean
  safeModeReason: SafeModeReason
  failedStarts: number
  onboardingCompleted: boolean
  dataFolder: string
}

export interface ThemeChangedEvent {
  theme: ThemeSource
  dark: boolean
}

export interface StartupFile {
  schema: 1
  attempts: number[]
  lastCleanAt: string | null
}

export interface WidgetRuntimeInfo {
  widgetId: string
  processId: number | null
  running: boolean
  cpuPercent: number
  memoryMB: number
  enabled: boolean
  disabledReason: string | null
  failures: number
}

export interface AppBundleSummary {
  id: string
  gridId: string
  gridTitle: string
  name: string
  apps: AppEntry[]
}

export interface AppGridWidgetOption {
  widgetId: string
  title: string
  enabled: boolean
}

export interface AppsAndBundlesState {
  apps: AppEntry[]
  hiddenCount: number
  bundles: AppBundleSummary[]
  scanning: boolean
  lastScanAt: string | null
  gridWidgets?: AppGridWidgetOption[]
}

export interface DiagnosticsExport {
  folder: string
  files: string[]
}

export type NoticeLevel = 'info' | 'warning' | 'error'

export interface Notice {
  id: string
  level: NoticeLevel
  message: string
  createdAt: string
}

export interface ShellState {
  widgetId: string
  variant: string | null
  editMode: boolean
  locked: boolean
  opacity: number
  theme: 'dark' | 'light'
  appearance: WidgetAppearance
  cursor: CursorConfig
  editPassthrough: boolean
}

export interface AppEntry {
  id: string
  name: string
  kind: 'lnk' | 'uwp' | 'steam'
  hidden: boolean
  iconUrl: string | null
}

export type AppGridItemRef = { type: 'app'; appId: string } | { type: 'bundle'; bundleId: string }

export interface AppGridRecord {
  items: AppGridItemRef[]
  title?: string
}

export interface AppGridFile {
  schema: 1
  grids: Record<string, AppGridRecord>
}

export interface AppBundleRecord {
  id: string
  gridId: string
  name: string
  appIds: string[]
}

export interface AppGroupsFile {
  schema: 1
  bundles: AppBundleRecord[]
}

export interface AppBundleView {
  id: string
  name: string
  apps: AppEntry[]
}

export type AppGridItemView =
  | { key: string; type: 'app'; app: AppEntry }
  | { key: string; type: 'bundle'; bundle: AppBundleView }

export interface AppGridState {
  widgetId: string
  title: string
  apps: AppEntry[]
  items: AppGridItemView[]
}

export interface BundlePopoverState {
  bundle: AppBundleView
}

export interface BundlePopoverResult {
  state: BundlePopoverState | null
  dissolved: boolean
}

export type WidgetApiErrorCode =
  | 'permission_denied'
  | 'invalid_args'
  | 'rate_limited'
  | 'too_large'
  | 'network_blocked'
  | 'timeout'
  | 'not_found'
  | 'internal'

export interface WidgetApiError {
  code: WidgetApiErrorCode
  message: string
}

export type WidgetApiResponse<T = unknown> =
  { ok: true; result: T } | { ok: false; error: WidgetApiError }

export interface ShellBatterySnapshot {
  level?: number
  charging?: boolean
}

export interface WidgetApiRequest {
  method: string
  params?: unknown
  shellBattery?: ShellBatterySnapshot | null
}

export interface WidgetContext {
  width: number
  height: number
  dark: boolean
  locale: string
  timeZone: string
}

export interface WidgetSystemStats {
  cpuPercent: number
  memUsedPercent: number
  memTotalGB: number
  uptimeSec: number
}

export interface WidgetBattery {
  level?: number
  charging?: boolean
}

export interface WidgetLogEntry {
  level: string
  message: string
  at: string
}

export type WidgetEventName = 'theme' | 'resize' | 'editmode' | 'apps'

export interface WidgetEvent {
  event: WidgetEventName
  data: unknown
}

export type AiProvider = 'gemini' | 'openai-compat'

export interface AiSettings {
  provider: AiProvider
  baseUrl: string
  model: string
  width: number
  height: number
}

export interface AiConfig extends AiSettings {
  hasKey: boolean
}

export interface AiManifest {
  name: string
  width: number
  height: number
  minWidth: number
  minHeight: number
  permissions: WidgetPermission[]
  allowedHosts: string[]
  refreshSeconds?: number | null
}

export interface AiGenerateSuccess {
  ok: true
  previewId: string
  manifest: AiManifest
  logs: WidgetLogEntry[]
  warnings: string[]
  repairs: number
}

export interface AiGenerateFailure {
  ok: false
  message: string
  problems: string[]
  logs: WidgetLogEntry[]
  warnings: string[]
  repairs: number
  canRepair: boolean
}

export type AiGenerateResult = AiGenerateSuccess | AiGenerateFailure

export interface AiApproval {
  permissions: WidgetPermission[]
  allowedHosts: string[]
}

export interface AiSaveResult {
  widgetId: string
  summary: WidgetSummary
}

export interface AiWidgetSource {
  widgetId: string
  manifest: WidgetManifest
  historyCount: number
}

export type AiTestResult = { ok: true; modelCount: number } | { ok: false; message: string }

export const WALLPAPER_FITS = ['fill', 'fit', 'stretch', 'tile', 'center', 'span'] as const
export type WallpaperFit = (typeof WALLPAPER_FITS)[number]

export const WALLPAPER_INTERVAL_MINUTES = [1, 5, 15, 30, 60, 1440] as const

export type WallpaperType = 'image' | 'video' | 'html'
export type WallpaperMode = 'static' | 'slideshow' | 'live'

export interface WallpaperItem {
  id: string
  name: string
  type: WallpaperType
  file: string
  fit: WallpaperFit
  posterFile?: string
  interactive?: boolean
}

export interface WallpaperConfig {
  mode: WallpaperMode
  currentId: string | null
  slideshowIds: string[]
  intervalMinutes: number
  shuffle: boolean
  pauseOnFullscreen: boolean
  pauseOnBattery: boolean
  videoMuted: boolean
  originalWallpaperPath: string | null
  originalWallpaperStyle: string | null
  originalWallpaperTile: string | null
  lastChangeAt: string | null
}

export interface WallpaperFile {
  schema: 1
  items: WallpaperItem[]
  config: WallpaperConfig
}

export interface WallpaperState {
  items: WallpaperItem[]
  config: WallpaperConfig
}

export interface WallpaperSlideshowSettings {
  enabled: boolean
  intervalMinutes: number
  shuffle: boolean
}

export interface WallpaperLiveOptions {
  pauseOnBattery: boolean
  videoMuted: boolean
}

export type WallpaperHostEvent =
  { type: 'pause'; paused: boolean } | { type: 'mouse'; x: number; y: number }
