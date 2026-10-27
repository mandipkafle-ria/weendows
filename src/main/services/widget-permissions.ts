import type { WidgetManifest, WidgetPermission } from '../../shared/types'

export function isPermissionGranted(
  manifest: Pick<WidgetManifest, 'grantedPermissions'>,
  permission: WidgetPermission
): boolean {
  return manifest.grantedPermissions.includes(permission)
}

export function hostIsApproved(
  manifest: Pick<WidgetManifest, 'allowedHosts'>,
  hostname: string
): boolean {
  const host = hostname.toLowerCase()
  return manifest.allowedHosts.some((allowed) => allowed.toLowerCase() === host)
}

export function withPermission(
  manifest: WidgetManifest,
  permission: WidgetPermission,
  granted: boolean
): WidgetManifest {
  const grantedPermissions = granted
    ? [...new Set([...manifest.grantedPermissions, permission])]
    : manifest.grantedPermissions.filter((item) => item !== permission)

  return { ...manifest, grantedPermissions }
}
