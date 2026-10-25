export const WIDGET_PERMISSIONS = [
  'system.stats',
  'system.processes',
  'system.apps',
  'system.media',
  'network.http',
  'ai.chat'
] as const

export type WidgetPermission = (typeof WIDGET_PERMISSIONS)[number]

export type WidgetKind = 'builtin' | 'ai' | 'imported'

export interface WidgetManifest {
  schema: 1
  id: string
  name: string
  kind: WidgetKind
  builtinType?: string
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  permissions: WidgetPermission[]
  grantedPermissions: WidgetPermission[]
  allowedHosts: string[]
  prompt?: string
  createdAt: string
  updatedAt: string
}

export interface WidgetPlacement {
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
  width: number
  height: number
  minWidth: number
  minHeight: number
}

export interface WidgetSummary {
  manifest: WidgetManifest
  placement: WidgetPlacement
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
  editMode: boolean
  locked: boolean
  opacity: number
}
