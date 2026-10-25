import type { BuiltinWidget, Notice, ShellState, WidgetSummary } from './types'

export const IPC = {
  getAppInfo: 'app:get-info',
  nativeCheck: 'native:check',
  getBuiltins: 'widgets:get-builtins',
  getWidgets: 'widgets:get-all',
  addWidget: 'widgets:add',
  removeWidget: 'widgets:remove',
  widgetsChanged: 'widgets:changed',
  getEditMode: 'layout:get-edit-mode',
  setEditMode: 'layout:set-edit-mode',
  editModeChanged: 'layout:edit-mode-changed',
  getNotices: 'notices:get',
  noticesChanged: 'notices:changed',
  shellGetState: 'shell:get-state',
  shellStateChanged: 'shell:state-changed',
  shellDragStart: 'shell:drag-start',
  shellDragEnd: 'shell:drag-end',
  shellResizeStart: 'shell:resize-start',
  shellResizeEnd: 'shell:resize-end',
  shellOpenSettings: 'shell:open-settings',
  shellRemove: 'shell:remove'
} as const

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
  getBuiltins: () => Promise<BuiltinWidget[]>
  getWidgets: () => Promise<WidgetSummary[]>
  addWidget: (builtinType: string) => Promise<WidgetSummary>
  removeWidget: (widgetId: string) => Promise<boolean>
  getEditMode: () => Promise<boolean>
  setEditMode: (enabled: boolean) => Promise<boolean>
  getNotices: () => Promise<Notice[]>
  onWidgetsChanged: (callback: () => void) => () => void
  onEditModeChanged: (callback: (enabled: boolean) => void) => () => void
  onNoticesChanged: (callback: (notices: Notice[]) => void) => () => void
}

export interface ShellApi {
  getState: () => Promise<ShellState>
  onStateChanged: (callback: (state: ShellState) => void) => () => void
  dragStart: () => void
  dragEnd: () => void
  resizeStart: () => void
  resizeEnd: () => void
  openSettings: () => void
  removeWidget: () => void
}
