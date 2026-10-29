import type { ThemeSource, WidgetAppearance, WidgetPlacement } from './types'

export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  themeOverride: null,
  bgColor: null,
  bgOpacity: 1,
  bgBlur: 0,
  bgStyle: 'solid',
  bgImage: null,
  bgImageFit: 'cover',
  cornerRadius: 18,
  borderWidth: 1,
  borderOpacity: 0.09,
  borderColor: null,
  contentOpacity: 1
}

export function resolveWidgetAppearance(
  placement: Partial<WidgetAppearance> | null | undefined
): WidgetAppearance {
  return {
    themeOverride: placement?.themeOverride ?? DEFAULT_WIDGET_APPEARANCE.themeOverride,
    bgColor: placement?.bgColor ?? DEFAULT_WIDGET_APPEARANCE.bgColor,
    bgOpacity: placement?.bgOpacity ?? DEFAULT_WIDGET_APPEARANCE.bgOpacity,
    bgBlur: placement?.bgBlur ?? DEFAULT_WIDGET_APPEARANCE.bgBlur,
    bgStyle: placement?.bgStyle ?? DEFAULT_WIDGET_APPEARANCE.bgStyle,
    bgImage: placement?.bgImage ?? DEFAULT_WIDGET_APPEARANCE.bgImage,
    bgImageFit: placement?.bgImageFit ?? DEFAULT_WIDGET_APPEARANCE.bgImageFit,
    cornerRadius: placement?.cornerRadius ?? DEFAULT_WIDGET_APPEARANCE.cornerRadius,
    borderWidth: placement?.borderWidth ?? DEFAULT_WIDGET_APPEARANCE.borderWidth,
    borderOpacity: placement?.borderOpacity ?? DEFAULT_WIDGET_APPEARANCE.borderOpacity,
    borderColor: placement?.borderColor ?? DEFAULT_WIDGET_APPEARANCE.borderColor,
    contentOpacity: placement?.contentOpacity ?? DEFAULT_WIDGET_APPEARANCE.contentOpacity
  }
}

export function widgetAppearanceFor(
  placement: WidgetPlacement | Partial<WidgetAppearance> | null | undefined
): WidgetAppearance {
  return resolveWidgetAppearance(placement)
}

function hexToRgba(color: string, alpha: number): string {
  const value = color.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`
}

function cssUrl(value: string): string {
  if (value.startsWith('data:image/')) {
    return `url("${value.replace(/["\\\n\r]/g, '')}")`
  }
  const safe = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `url('${safe}')`
}

export function appearanceCss(appearance: WidgetAppearance): string {
  const rules: string[] = []
  const radius = appearance.cornerRadius
  const borderWidth = Math.max(0, Math.min(8, appearance.borderWidth))
  rules.push(
    `:root { --widget-corner-radius: ${radius}px; --widget-border-width: ${borderWidth}px; }`
  )
  rules.push(`.card { border-radius: ${radius}px !important; }`)

  const backgroundParts: string[] = []
  const bgColor = appearance.bgColor
  const bgOpacity = appearance.bgOpacity

  if (appearance.bgStyle !== 'transparent' && appearance.bgImage) {
    backgroundParts.push(`background-image: ${cssUrl(appearance.bgImage)} !important;`)
    if (appearance.bgImageFit === 'tile') {
      backgroundParts.push('background-size: auto !important;')
      backgroundParts.push('background-repeat: repeat !important;')
      backgroundParts.push('background-position: 0 0 !important;')
    } else {
      backgroundParts.push(`background-size: ${appearance.bgImageFit} !important;`)
      backgroundParts.push('background-repeat: no-repeat !important;')
      backgroundParts.push('background-position: center !important;')
    }
    if (bgColor) {
      backgroundParts.push(`background-color: ${hexToRgba(bgColor, bgOpacity)} !important;`)
    }
  } else if (appearance.bgStyle === 'transparent') {
    backgroundParts.push('background: transparent !important;')
  } else if (bgColor) {
    backgroundParts.push(`background: ${hexToRgba(bgColor, bgOpacity)} !important;`)
  }

  if (appearance.bgStyle === 'blur') {
    backgroundParts.push(`backdrop-filter: blur(${appearance.bgBlur}px);`)
    backgroundParts.push(`-webkit-backdrop-filter: blur(${appearance.bgBlur}px);`)
  }

  if (backgroundParts.length > 0) {
    rules.push(`.card { ${backgroundParts.join(' ')} }`)
  }

  const borderColor = appearance.borderColor ?? '#ffffff'
  // The border is drawn as an inset ring so it never changes the widget's box
  // (a real border would shrink its content) and never paints outside the
  // rounded silhouette. The widget's own design border stays underneath.
  rules.push(
    `.card { box-shadow: inset 0 0 0 ${borderWidth}px ${hexToRgba(
      borderColor,
      appearance.borderOpacity
    )}, inset 0 1px 0 rgba(255, 255, 255, 0.06) !important; }`
  )

  if (appearance.contentOpacity < 1) {
    rules.push(`.card > * { opacity: ${appearance.contentOpacity} !important; }`)
  }

  return rules.join('\n')
}

export function hasCustomAppearance(appearance: WidgetAppearance): boolean {
  return (
    appearance.themeOverride !== DEFAULT_WIDGET_APPEARANCE.themeOverride ||
    appearance.bgColor !== DEFAULT_WIDGET_APPEARANCE.bgColor ||
    appearance.bgOpacity !== DEFAULT_WIDGET_APPEARANCE.bgOpacity ||
    appearance.bgBlur !== DEFAULT_WIDGET_APPEARANCE.bgBlur ||
    appearance.bgStyle !== DEFAULT_WIDGET_APPEARANCE.bgStyle ||
    appearance.bgImage !== DEFAULT_WIDGET_APPEARANCE.bgImage ||
    appearance.bgImageFit !== DEFAULT_WIDGET_APPEARANCE.bgImageFit ||
    appearance.cornerRadius !== DEFAULT_WIDGET_APPEARANCE.cornerRadius ||
    appearance.borderWidth !== DEFAULT_WIDGET_APPEARANCE.borderWidth ||
    appearance.borderOpacity !== DEFAULT_WIDGET_APPEARANCE.borderOpacity ||
    appearance.borderColor !== DEFAULT_WIDGET_APPEARANCE.borderColor ||
    appearance.contentOpacity !== DEFAULT_WIDGET_APPEARANCE.contentOpacity
  )
}

export function resolveTheme(theme: ThemeSource, systemDark: boolean): 'dark' | 'light' {
  if (theme === 'dark') {
    return 'dark'
  }
  if (theme === 'light') {
    return 'light'
  }
  return systemDark ? 'dark' : 'light'
}

export function resolveWidgetTheme(
  themeOverride: 'dark' | 'light' | null | undefined,
  widgetDefaultTheme: ThemeSource,
  systemDark: boolean
): 'dark' | 'light' {
  return themeOverride ?? resolveTheme(widgetDefaultTheme, systemDark)
}
