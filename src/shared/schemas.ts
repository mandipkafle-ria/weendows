import { z } from 'zod'
import { GRID_TITLE_MAX, WALLPAPER_ID_RE, WIDGET_ID_RE } from './constants'
import {
  ACCENT_COLORS,
  CURSOR_CLICK_ANIMATIONS,
  CURSOR_STYLES,
  WALLPAPER_FITS,
  WALLPAPER_INTERVAL_MINUTES,
  WIDGET_BG_IMAGE_FITS,
  WIDGET_BG_STYLES,
  WIDGET_PERMISSIONS
} from './types'

export const noArgsSchema = z.undefined()

export const themeSourceSchema = z.enum(['dark', 'light', 'system'])
export const accentColorSchema = z.enum(ACCENT_COLORS)
const LEGACY_CURSOR_STYLES = new Set(['dot', 'neon', 'ring', 'arrow'])
export const cursorStyleSchema = z.preprocess(
  (value) => (typeof value === 'string' && LEGACY_CURSOR_STYLES.has(value) ? 'system' : value),
  z.enum(CURSOR_STYLES)
)
export const cursorClickAnimationSchema = z.enum(CURSOR_CLICK_ANIMATIONS)
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')
export const widgetBgStyleSchema = z.enum(WIDGET_BG_STYLES)
export const widgetBgImageFitSchema = z.enum(WIDGET_BG_IMAGE_FITS)
export const widgetThemeOverrideSchema = z.enum(['dark', 'light']).nullable()
export const cursorConfigPatchSchema = z
  .object({
    style: cursorStyleSchema.optional(),
    color: hexColorSchema.optional(),
    size: z.number().min(8).max(24).optional(),
    opacity: z.number().min(0.1).max(1).optional(),
    glowIntensity: z.number().min(0).max(1).optional(),
    clickAnimation: cursorClickAnimationSchema.optional(),
    systemWide: z.boolean().optional()
  })
  .strict()
export const acceleratorSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9+]+$/, 'Invalid shortcut')
export const windowSizeSchema = z.object({
  width: z.number().int().min(720).max(10000),
  height: z.number().int().min(520).max(10000)
})
export const appSettingsSchema = z
  .object({
    schema: z.literal(1),
    theme: themeSourceSchema,
    widgetDefaultTheme: themeSourceSchema.default('system'),
    accent: accentColorSchema.default('ember'),
    cursorStyle: cursorStyleSchema.default('system'),
    cursorSystemWide: z.boolean().default(false),
    cursorColor: hexColorSchema.default('#ffffff'),
    cursorSize: z.number().min(8).max(24).default(12),
    cursorOpacity: z.number().min(0.1).max(1).default(1),
    cursorGlow: z.number().min(0).max(1).default(0.5),
    cursorClickAnimation: cursorClickAnimationSchema.default('ripple'),
    hotkey: acceleratorSchema,
    window: windowSizeSchema,
    onboardingCompleted: z.boolean()
  })
  .passthrough()
export const startupFileSchema = z
  .object({
    schema: z.literal(1),
    attempts: z.array(z.number().int().nonnegative()).max(50),
    lastCleanAt: z.string().max(64).nullable()
  })
  .passthrough()

export const widgetIdSchema = z.string().regex(WIDGET_ID_RE, 'Invalid widget id')
export const builtinTypeSchema = z.string().min(1).max(64)
export const widgetVariantSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid widget variant')
export const opacitySchema = z.number().min(0.2).max(1)
export const permissionSchema = z.enum(WIDGET_PERMISSIONS)
export const appIdSchema = z.string().min(1).max(128)
export const bundleIdSchema = z.string().min(1).max(128)
export const bundleNameSchema = z.string().trim().min(1).max(24)
export const gridTitleSchema = z.string().trim().min(1).max(GRID_TITLE_MAX)
export const gridIndexSchema = z.number().int().min(0).max(1000)
export const appGridItemRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('app'), appId: appIdSchema }),
  z.object({ type: z.literal('bundle'), bundleId: bundleIdSchema })
])
export const appGridFileSchema = z.object({
  schema: z.literal(1),
  grids: z.record(
    z.string().min(1).max(128),
    z.object({
      items: z.array(appGridItemRefSchema).max(1000),
      title: gridTitleSchema.optional()
    })
  )
})
export const appGroupsFileSchema = z.object({
  schema: z.literal(1),
  bundles: z
    .array(
      z.object({
        id: bundleIdSchema,
        gridId: z.string().min(1).max(128),
        name: z.string().min(1).max(24),
        appIds: z.array(appIdSchema).max(1000)
      })
    )
    .max(1000)
})
export const appIdsSchema = z.array(appIdSchema).min(1).max(200)
export const gridRenameTitleSchema = z.object({ title: gridTitleSchema })
export const gridMoveSchema = z.object({ from: gridIndexSchema, to: gridIndexSchema })
export const gridMergeSchema = z.object({
  appId: appIdSchema,
  targetKey: z.string().min(1).max(160)
})
export const gridOpenBundleSchema = z.object({
  bundleId: bundleIdSchema,
  rect: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive().max(10000),
    height: z.number().positive().max(10000),
    variant: z.string().optional()
  })
})
export const bundleReorderSchema = z.object({ from: gridIndexSchema, to: gridIndexSchema })
export const gridCreateBundleSchema = z.object({
  name: z.string().trim().min(1).max(24),
  appIds: appIdsSchema
})
export const gridRemoveBundleSchema = z.object({ bundleId: bundleIdSchema })

const hostnameSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/i,
    'allowedHosts must contain plain host names'
  )
  .transform((value) => value.toLowerCase())

export const aiManifestSchema = z.object({
  name: z.string().trim().min(1).max(40),
  width: z.number().int().min(120).max(800),
  height: z.number().int().min(120).max(800),
  minWidth: z.number().int().min(1).max(800).optional(),
  minHeight: z.number().int().min(1).max(800).optional(),
  permissions: z
    .array(permissionSchema)
    .max(WIDGET_PERMISSIONS.length)
    .refine((items) => new Set(items).size === items.length, 'permissions must not repeat'),
  allowedHosts: z
    .array(hostnameSchema)
    .max(5)
    .refine((items) => new Set(items).size === items.length, 'allowedHosts must not repeat'),
  refreshSeconds: z.number().int().min(1).max(86400).nullable().optional()
})

export const aiProviderSchema = z.enum(['gemini', 'openai-compat'])
export const aiSettingsSchema = z.object({
  provider: aiProviderSchema,
  baseUrl: z.string().trim().min(1).max(500),
  model: z.string().trim().max(200),
  width: z.number().int().min(120).max(800),
  height: z.number().int().min(120).max(800)
})
export const aiPromptSchema = z.string().trim().min(1).max(4000)
export const aiInstructionSchema = z.string().trim().min(1).max(4000)
export const aiKeySchema = z.string().max(4096)
export const aiApprovalSchema = z.object({
  permissions: z.array(permissionSchema).max(WIDGET_PERMISSIONS.length),
  allowedHosts: z.array(hostnameSchema).max(5)
})

export const widgetManifestSchema = z
  .object({
    schema: z.literal(1),
    id: widgetIdSchema,
    name: z.string().min(1).max(40),
    kind: z.enum(['builtin', 'ai', 'imported']),
    builtinType: z.string().min(1).max(64).optional(),
    variant: widgetVariantSchema.optional(),
    width: z.number().int().positive().max(10000),
    height: z.number().int().positive().max(10000),
    minWidth: z.number().int().positive().max(10000).optional(),
    minHeight: z.number().int().positive().max(10000).optional(),
    focusable: z.boolean().optional(),
    editPassthrough: z.boolean().optional(),
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
    opacity: opacitySchema,
    themeOverride: widgetThemeOverrideSchema.default(null),
    bgColor: hexColorSchema.nullable().default(null),
    bgOpacity: z.number().min(0).max(1).default(1),
    bgBlur: z.number().min(0).max(20).default(0),
    bgStyle: widgetBgStyleSchema.default('solid'),
    bgImage: z.string().max(4096).nullable().default(null),
    bgImageFit: widgetBgImageFitSchema.default('cover'),
    cornerRadius: z.number().min(0).max(64).default(18),
    borderWidth: z.number().min(0).max(8).default(1),
    borderOpacity: z.number().min(0).max(1).default(0.09),
    borderColor: hexColorSchema.nullable().default(null),
    contentOpacity: z.number().min(0).max(1).default(1)
  })
  .passthrough()

const widgetBgImageRefSchema = z
  .string()
  .max(20_000_000)
  .refine(
    (value) =>
      /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value) ||
      /^background\.(png|jpe?g|webp|gif)$/i.test(value),
    { message: 'Invalid background image reference' }
  )

export const widgetAppearancePatchSchema = z
  .object({
    themeOverride: widgetThemeOverrideSchema.optional(),
    bgColor: hexColorSchema.nullable().optional(),
    bgOpacity: z.number().min(0).max(1).optional(),
    bgBlur: z.number().min(0).max(20).optional(),
    bgStyle: widgetBgStyleSchema.optional(),
    bgImage: widgetBgImageRefSchema.nullable().optional(),
    bgImageFit: widgetBgImageFitSchema.optional(),
    cornerRadius: z.number().min(0).max(64).optional(),
    borderWidth: z.number().min(0).max(8).optional(),
    borderOpacity: z.number().min(0).max(1).optional(),
    borderColor: hexColorSchema.nullable().optional(),
    contentOpacity: z.number().min(0).max(1).optional()
  })
  .strict()

/** Rectangle a widget should occupy, relative to one display's top-left. */
export const widgetBoundsPatchSchema = z
  .object({
    displayId: z.string().min(1).max(64),
    x: z.number().finite().min(-100_000).max(100_000),
    y: z.number().finite().min(-100_000).max(100_000),
    width: z.number().finite().min(1).max(20_000),
    height: z.number().finite().min(1).max(20_000)
  })
  .strict()

export const layoutFileSchema = z
  .object({
    schema: z.literal(1),
    placements: z.array(widgetPlacementSchema)
  })
  .passthrough()

export const wallpaperIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(WALLPAPER_ID_RE, 'Invalid wallpaper id')
export const wallpaperFitSchema = z.enum(WALLPAPER_FITS)
export const wallpaperIntervalSchema = z
  .number()
  .int()
  .refine((value) => (WALLPAPER_INTERVAL_MINUTES as readonly number[]).includes(value), {
    message: 'Invalid slideshow interval'
  })

export const wallpaperItemSchema = z
  .object({
    id: wallpaperIdSchema,
    name: z.string().min(1).max(120),
    type: z.enum(['image', 'video', 'html']),
    file: z.string().min(1).max(4096),
    fit: wallpaperFitSchema,
    posterFile: z.string().min(1).max(4096).optional(),
    interactive: z.boolean().optional()
  })
  .passthrough()

export const wallpaperConfigSchema = z
  .object({
    mode: z.enum(['static', 'slideshow', 'live']),
    currentId: wallpaperIdSchema.nullable(),
    slideshowIds: z.array(wallpaperIdSchema).max(1000),
    intervalMinutes: wallpaperIntervalSchema,
    shuffle: z.boolean(),
    pauseOnFullscreen: z.boolean(),
    pauseOnBattery: z.boolean(),
    videoMuted: z.boolean(),
    originalWallpaperPath: z.string().max(4096).nullable(),
    originalWallpaperStyle: z.string().max(16).nullable().default(null),
    originalWallpaperTile: z.string().max(16).nullable().default(null),
    lastChangeAt: z.string().max(64).nullable()
  })
  .passthrough()

export const wallpaperFileSchema = z
  .object({
    schema: z.literal(1),
    items: z.array(wallpaperItemSchema).max(1000),
    config: wallpaperConfigSchema
  })
  .passthrough()

export const wallpaperSlideshowSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: wallpaperIntervalSchema,
  shuffle: z.boolean()
})

export const wallpaperLiveOptionsSchema = z.object({
  pauseOnBattery: z.boolean(),
  videoMuted: z.boolean()
})
