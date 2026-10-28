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
