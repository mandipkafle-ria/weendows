export const APP_ID = 'com.yourname.homelayer'
export const APP_NAME = 'HomeLayer'
export const SETTINGS_WINDOW_WIDTH = 880
export const SETTINGS_WINDOW_HEIGHT = 620

export const WIDGET_ID_RE = /^[a-z0-9][a-z0-9-]*$/
export const CLOCK_WIDGET_ID = 'clock'
export const CLOCK_WIDGET_WIDTH = 240
export const CLOCK_WIDGET_HEIGHT = 140
export const WIDGET_PIN_INTERVAL_MS = 2000
export const WIDGET_FOREGROUND_REPIN_MS = 500
export const WIDGET_FOREGROUND_REPIN_INTERVAL_MS = 16

export const LAYOUT_SCHEMA_VERSION = 1
export const LAYOUT_WRITE_DEBOUNCE_MS = 500
export const MIN_VISIBLE_DIP = 48
export const SNAP_STEP_DIP = 8
export const MAGNETISM_DIP = 8
export const WIDGET_DRAG_INTERVAL_MS = 8
export const WIDGET_DRAG_WATCHDOG_MS = 30000
export const WIDGET_CASCADE_OFFSET_DIP = 24
export const EDIT_MODE_HOTKEY = 'Control+Alt+E'

export const WIDGET_SESSION_PARTITION = 'homelayer-widget'

export const WIDGET_API_METHOD_MAX = 64
export const WIDGET_API_PARAMS_MAX_BYTES = 64 * 1024
export const WIDGET_API_CALL_TIMEOUT_MS = 15000
export const WIDGET_CALLS_PER_SECOND = 30
export const WIDGET_NET_CALLS_PER_MINUTE = 60
export const WIDGET_STATS_SAMPLE_MS = 2000
export const WIDGET_STATS_MIN_CALL_MS = 1000
export const WIDGET_STORAGE_TOTAL_BYTES = 256 * 1024
export const WIDGET_STORAGE_KEY_MAX = 64
export const WIDGET_STORAGE_VALUE_MAX = 64 * 1024
export const WIDGET_NET_TIMEOUT_MS = 10000
export const WIDGET_NET_MAX_RESPONSE_BYTES = 2 * 1024 * 1024
export const WIDGET_NET_MAX_REDIRECTS = 3
export const WIDGET_OPEN_LINK_INTERVAL_MS = 3000
export const WIDGET_LOG_LIMIT = 200
export const WIDGET_LOG_MESSAGE_MAX = 500
export const WIDGET_CRASH_LIMIT = 5
export const WIDGET_CRASH_WINDOW_MS = 120000
export const WIDGET_HEARTBEAT_INTERVAL_MS = 4000
export const WIDGET_HEARTBEAT_TIMEOUT_MS = 20000

export const APP_GRID_TYPE = 'app-grid'
export const APP_GRID_COLUMNS = 4
export const APP_GRID_TILE_WIDTH = 80
export const APP_GRID_TILE_HEIGHT = 96
export const APP_GRID_GAP = 12
export const APP_GRID_DEFAULT_WIDTH = 384
export const APP_GRID_DEFAULT_HEIGHT = 280
export const APP_GRID_MIN_WIDTH = 320
export const APP_GRID_MIN_HEIGHT = 180
export const APP_ICON_ID_RE = /^[a-f0-9]{40}$/
export const APP_SCAN_DEBOUNCE_MS = 2000
export const APP_SCAN_TIMEOUT_MS = 10000
export const APP_DRAG_THRESHOLD_DIP = 8
export const APP_MERGE_HOVER_MS = 500
export const BUNDLE_NAME_MAX = 24
export const GRID_TITLE_MAX = 32
export const BUNDLE_POPOVER_WIDTH = 280
export const BUNDLE_POPOVER_HEADER_HEIGHT = 58
export const BUNDLE_POPOVER_ROW_HEIGHT = 82
export const BUNDLE_POPOVER_MAX_ROWS = 4
export const BUNDLE_POPOVER_CLOSE_GRACE_MS = 150
export const BUNDLE_POPOVER_ANIMATION_MS = 160

export const AI_TIMEOUT_MS = 60000
export const AI_MAX_REPAIRS = 2
export const AI_MIN_SIZE_RATIO = 0.75
export const AI_MAX_HTML_BYTES = 150000
export const AI_HISTORY_LIMIT = 5
export const AI_PREVIEW_PREFIX = 'preview-'
export const AI_PREVIEW_LOG_WAIT_MS = 3000

export const WALLPAPER_ID_RE = /^[a-z0-9][a-z0-9-]*$/
export const WALLPAPER_THUMBNAIL_WIDTH = 320
export const WALLPAPER_DEFAULT_INTERVAL_MINUTES = 5
export const WALLPAPER_VIDEO_WARN_BYTES = 500 * 1024 * 1024
export const WALLPAPER_VIDEO_WARN_WIDTH = 1920
export const WALLPAPER_VIDEO_WARN_HEIGHT = 1080
export const WALLPAPER_VIDEO_WARN_FPS = 30

export const WIDGET_CSP = [
  `default-src 'none'`,
  `script-src 'unsafe-inline' widget:`,
  `style-src 'unsafe-inline' widget: https://fonts.googleapis.com`,
  `img-src data: blob: hl-icon: widget:`,
  `font-src data: widget: https://fonts.gstatic.com`,
  `media-src data: blob: widget:`,
  `connect-src 'none'`,
  `frame-src 'none'`,
  `object-src 'none'`,
  `base-uri 'none'`,
  `form-action 'none'`
].join('; ')
