import { z } from 'zod'
import { WIDGET_ID_RE } from './constants'
import { WIDGET_PERMISSIONS } from './types'

export const noArgsSchema = z.undefined()

export const widgetIdSchema = z.string().regex(WIDGET_ID_RE, 'Invalid widget id')
export const builtinTypeSchema = z.string().min(1).max(64)
export const opacitySchema = z.number().min(0.2).max(1)
export const permissionSchema = z.enum(WIDGET_PERMISSIONS)

export const widgetManifestSchema = z
  .object({
    schema: z.literal(1),
    id: widgetIdSchema,
    name: z.string().min(1).max(40),
    kind: z.enum(['builtin', 'ai', 'imported']),
    builtinType: z.string().min(1).max(64).optional(),
    width: z.number().int().positive().max(10000),
    height: z.number().int().positive().max(10000),
    minWidth: z.number().int().positive().max(10000).optional(),
    minHeight: z.number().int().positive().max(10000).optional(),
    permissions: z.array(permissionSchema).default([]),
    grantedPermissions: z.array(permissionSchema).default([]),
    allowedHosts: z.array(z.string()).default([]),
    prompt: z.string().max(4000).optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1)
  })
  .passthrough()

export const widgetPlacementSchema = z
  .object({
    widgetId: widgetIdSchema,
    displayId: z.string().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    zOrder: z.number().int(),
    locked: z.boolean(),
    enabled: z.boolean(),
    opacity: opacitySchema
  })
  .passthrough()

export const layoutFileSchema = z
  .object({
    schema: z.literal(1),
    placements: z.array(widgetPlacementSchema)
  })
  .passthrough()
