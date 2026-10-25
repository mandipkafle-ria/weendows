export const APP_ID = 'com.yourname.homelayer'
export const APP_NAME = 'HomeLayer'
export const SETTINGS_WINDOW_WIDTH = 880
export const SETTINGS_WINDOW_HEIGHT = 620

export const WIDGET_ID_RE = /^[a-z0-9][a-z0-9-]*$/
export const CLOCK_WIDGET_ID = 'clock'
export const CLOCK_WIDGET_WIDTH = 240
export const CLOCK_WIDGET_HEIGHT = 140
export const WIDGET_PIN_INTERVAL_MS = 2000

export const LAYOUT_SCHEMA_VERSION = 1
export const LAYOUT_WRITE_DEBOUNCE_MS = 500
export const MIN_VISIBLE_DIP = 48
export const SNAP_STEP_DIP = 8
export const MAGNETISM_DIP = 8
export const WIDGET_DRAG_INTERVAL_MS = 8
export const WIDGET_DRAG_WATCHDOG_MS = 30000
export const WIDGET_CASCADE_OFFSET_DIP = 24
export const EDIT_MODE_HOTKEY = 'Control+Alt+E'

export const WIDGET_CSP = [
  `default-src 'none'`,
  `script-src 'unsafe-inline' widget:`,
  `style-src 'unsafe-inline'`,
  `img-src data: blob:`,
  `font-src data: widget:`,
  `media-src data: blob:`,
  `connect-src 'none'`,
  `frame-src 'none'`,
  `object-src 'none'`,
  `base-uri 'none'`,
  `form-action 'none'`
].join('; ')
