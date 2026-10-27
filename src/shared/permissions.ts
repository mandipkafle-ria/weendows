import type { WidgetPermission } from './types'

export const PERMISSION_LABELS: Record<WidgetPermission, string> = {
  'system.stats': 'Read CPU and memory stats',
  'system.battery': 'Read the battery level',
  storage: 'Store data for this widget',
  network: 'Contact approved websites',
  launch: 'Launch installed apps',
  openLink: 'Open links in your browser'
}

export function permissionLabel(permission: WidgetPermission): string {
  return PERMISSION_LABELS[permission]
}
