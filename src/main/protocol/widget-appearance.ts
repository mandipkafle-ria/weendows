import type { WidgetAppearance } from '../../shared/types'
import { appearanceCss, hasCustomAppearance } from '../../shared/appearance'

export { appearanceCss, hasCustomAppearance }

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
