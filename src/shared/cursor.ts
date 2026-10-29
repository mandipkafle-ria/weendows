import type { CursorConfig } from './types'

export const DEFAULT_CURSOR_CONFIG: CursorConfig = {
  style: 'system',
  color: '#ffffff',
  size: 12,
  opacity: 1,
  glowIntensity: 0.5,
  clickAnimation: 'ripple',
  systemWide: false
}

export interface CursorImage {
  url: string
  hotspotX: number
  hotspotY: number
}

function pixelPath(): string {
  return 'M2 1h4v2h3v2h3v2h3v5h-4v2h3v3h-3v-2H7v-3H5V8H3V6H2z'
}

export function cursorImage(config: CursorConfig): CursorImage | null {
  if (config.style === 'system') {
    return null
  }

  const size = Math.max(8, Math.min(24, config.size))
  const opacity = Math.max(0.1, Math.min(1, config.opacity))
  const pad = 10
  const extent = size + pad * 2
  const center = extent / 2
  const color = config.color

  let shape: string
  let hotspotX: number
  let hotspotY: number

  switch (config.style) {
    case 'pixel':
      shape = `<g transform="translate(${pad} ${pad}) scale(${size / 16})" shape-rendering="crispEdges"><path d="${pixelPath()}" fill="${color}" stroke="#000000" stroke-width="1" opacity="${opacity}"/></g>`
      hotspotX = pad + 2
      hotspotY = pad + 1
      break
    case 'crosshair':
      shape = `<g stroke="${color}" stroke-width="1.6" opacity="${opacity}"><path d="M${center} ${
        pad
      }V${center - 3}M${center} ${center + 3}V${extent - pad}M${pad} ${center}H${
        center - 3
      }M${center + 3} ${center}H${extent - pad}"/><circle cx="${center}" cy="${center}" r="1.4" fill="${color}" stroke="none"/></g>`
      hotspotX = center
      hotspotY = center
      break
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${extent}" height="${extent}" viewBox="0 0 ${extent} ${extent}">${shape}</svg>`
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    hotspotX: Math.round(hotspotX),
    hotspotY: Math.round(hotspotY)
  }
}
