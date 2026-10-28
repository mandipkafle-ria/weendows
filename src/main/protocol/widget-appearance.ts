import type { WidgetAppearance } from '../../shared/types'
import { DEFAULT_WIDGET_APPEARANCE } from '../../shared/appearance'

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
  rules.push(`:root { --widget-corner-radius: ${radius}px; }`)
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
  rules.push(
    `.card { box-shadow: inset 0 0 0 1px ${hexToRgba(
      borderColor,
      appearance.borderOpacity
    )}, 0 12px 34px rgba(0, 0, 0, 0.22) !important; }`
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
    appearance.borderOpacity !== DEFAULT_WIDGET_APPEARANCE.borderOpacity ||
    appearance.borderColor !== DEFAULT_WIDGET_APPEARANCE.borderColor ||
    appearance.contentOpacity !== DEFAULT_WIDGET_APPEARANCE.contentOpacity
  )
}

export function injectAppearance(html: string, appearance: WidgetAppearance): string {
  if (!hasCustomAppearance(appearance)) {
    return html
  }
  const style = `<style data-homelayer-appearance>${appearanceCss(appearance)}</style>`
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, (match) => style + match)
  }
  return style + html
}
