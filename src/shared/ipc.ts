export const IPC = {
  getAppInfo: 'app:get-info',
  nativeCheck: 'native:check'
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
}
