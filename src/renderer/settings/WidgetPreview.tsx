import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { appearanceCss, hasCustomAppearance } from '../../shared/appearance'
import type {
  AppEntry,
  AppGridState,
  CursorStyle,
  WidgetApiErrorCode,
  WidgetAppearance,
  WidgetContext,
  WidgetSystemStats
} from '../../shared/types'

export type PreviewSource =
  | { kind: 'builtin'; type: string; variant: string }
  | { kind: 'widget'; id: string; variant?: string | null }

interface WidgetPreviewProps {
  source: PreviewSource
  width: number
  height: number
  dark: boolean
  cursorStyle: CursorStyle
  env?: string
  appearance?: WidgetAppearance
  assetWidgetId?: string
  title: string
  interactive?: boolean
  className?: string
}

const BROWSER_ICON =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg-b" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="%230066ff"/><stop offset="100%" stop-color="%2300d4ff"/></linearGradient><linearGradient id="needle-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23ff3366"/><stop offset="100%" stop-color="%23ff6b6b"/></linearGradient><linearGradient id="needle-w" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23ffffff"/><stop offset="100%" stop-color="%23cbd5e1"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(%23bg-b)"/><circle cx="32" cy="32" r="22" stroke="rgba(255,255,255,0.4)" stroke-width="2" fill="rgba(255,255,255,0.08)"/><circle cx="32" cy="32" r="16" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="2 3" fill="none"/><g transform="rotate(45 32 32)"><polygon points="32,13 36,32 32,30 28,32" fill="url(%23needle-r)"/><polygon points="32,51 36,32 32,30 28,32" fill="url(%23needle-w)"/><circle cx="32" cy="32" r="3.5" fill="%23ffffff"/><circle cx="32" cy="32" r="1.8" fill="%230066ff"/></g></svg>'

const FILES_ICON =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg-f" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="%230284c7"/><stop offset="100%" stop-color="%2338bdf8"/></linearGradient><linearGradient id="sheet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23ffffff"/><stop offset="100%" stop-color="%23f1f5f9"/></linearGradient><linearGradient id="front" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%2338bdf8"/><stop offset="100%" stop-color="%230369a1"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(%23bg-f)"/><path d="M14 22c0-1.1.9-2 2-2h10l3 3h19c1.1 0 2 .9 2 2v23c0 1.1-.9 2-2 2H16c-1.1 0-2-.9-2-2V22z" fill="%23026aa2"/><rect x="18" y="22" width="28" height="20" rx="3" fill="url(%23sheet)"/><line x1="22" y1="27" x2="36" y2="27" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="32" x2="40" y2="32" stroke="%23cbd5e1" stroke-width="2" stroke-linecap="round"/><path d="M14 28c0-1.1.9-2 2-2h32c1.1 0 2 .9 2 2v18c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V28z" fill="url(%23front)"/></svg>'

const MUSIC_ICON =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg-m" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="%23ff007a"/><stop offset="50%" stop-color="%23a855f7"/><stop offset="100%" stop-color="%236366f1"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(%23bg-m)"/><path d="M26 42a5 5 0 1 1-5-5c1.4 0 2.6.5 3.5 1.3V19c0-1.1.9-2 2-2l16-3.5c1.2-.3 2.5.6 2.5 1.8v18.2a5 5 0 1 1-5-5c1.4 0 2.6.5 3.5 1.3V21l-14 3v16.5a5 5 0 0 1-2.5-.5z" fill="%23ffffff"/></svg>'

const TERMINAL_ICON =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg-t" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="%231e293b"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(%23bg-t)" stroke="rgba(255,255,255,0.14)" stroke-width="1.5"/><rect x="8" y="14" width="48" height="36" rx="6" fill="%23020617" stroke="rgba(255,255,255,0.08)"/><circle cx="15" cy="20" r="2" fill="%23ef4444"/><circle cx="21" cy="20" r="2" fill="%23f59e0b"/><circle cx="27" cy="20" r="2" fill="%2310b981"/><path d="M16 29l6 5-6 5" fill="none" stroke="%2322c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="26" y1="39" x2="36" y2="39" stroke="%2338bdf8" stroke-width="2.5" stroke-linecap="round"/></svg>'

const NOTES_ICON =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg-n" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23d97706"/></linearGradient><linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23ffffff"/><stop offset="100%" stop-color="%23fef3c7"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(%23bg-n)"/><rect x="14" y="12" width="36" height="40" rx="5" fill="url(%23paper)"/><line x1="20" y1="22" x2="44" y2="22" stroke="%23cbd5e1" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="28" x2="44" y2="28" stroke="%23cbd5e1" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="34" x2="44" y2="34" stroke="%23cbd5e1" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="40" x2="34" y2="40" stroke="%23cbd5e1" stroke-width="2" stroke-linecap="round"/><g transform="translate(36,26) rotate(42)"><rect x="0" y="0" width="6" height="20" rx="2" fill="%23ef4444"/><polygon points="0,20 6,20 3,25" fill="%23fbbf24"/><polygon points="2,24 4,24 3,26" fill="%231e293b"/></g></svg>'

const SETTINGS_ICON =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg-s" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="%2364748b"/><stop offset="100%" stop-color="%23334155"/></linearGradient><linearGradient id="gear" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23f8fafc"/><stop offset="100%" stop-color="%2394a3b8"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(%23bg-s)"/><g transform="translate(32,32)"><circle r="16" fill="url(%23gear)"/><circle r="7" fill="%23334155"/><circle r="4" fill="%231e293b"/><rect x="-3" y="-21" width="6" height="42" rx="2" fill="url(%23gear)"/><rect x="-3" y="-21" width="6" height="42" rx="2" fill="url(%23gear)" transform="rotate(45)"/><rect x="-3" y="-21" width="6" height="42" rx="2" fill="url(%23gear)" transform="rotate(90)"/><rect x="-3" y="-21" width="6" height="42" rx="2" fill="url(%23gear)" transform="rotate(135)"/></g></svg>'

const DEMO_APPS: AppEntry[] = [
  { id: 'preview-browser', name: 'Browser', kind: 'lnk', hidden: false, iconUrl: BROWSER_ICON },
  { id: 'preview-files', name: 'Files', kind: 'lnk', hidden: false, iconUrl: FILES_ICON },
  { id: 'preview-music', name: 'Music', kind: 'lnk', hidden: false, iconUrl: MUSIC_ICON },
  { id: 'preview-terminal', name: 'Terminal', kind: 'lnk', hidden: false, iconUrl: TERMINAL_ICON },
  { id: 'preview-notes', name: 'Notes', kind: 'lnk', hidden: false, iconUrl: NOTES_ICON },
  { id: 'preview-settings', name: 'Settings', kind: 'uwp', hidden: false, iconUrl: SETTINGS_ICON }
]

const DEMO_STATS: WidgetSystemStats = {
  cpuPercent: 24,
  memUsedPercent: 58,
  memTotalGB: 16,
  uptimeSec: 93_400
}

const stores = new Map<string, Map<string, unknown>>()
let cachedStats: WidgetSystemStats | null = null
let lastStatsAt = 0
let statsRequest: Promise<WidgetSystemStats> | null = null

function previewKey(source: PreviewSource): string {
  return source.kind === 'builtin' ? `builtin:${source.type}` : `widget:${source.id}`
}

function seededStore(key: string): Map<string, unknown> {
  const existing = stores.get(key)
  if (existing) {
    return existing
  }
  const store = new Map<string, unknown>()
  if (key === 'builtin:weather') {
    store.set('lat', 38.7223)
    store.set('lon', -9.1393)
    store.set('city', 'Lisbon, PT')
  }
  if (key === 'builtin:notes') {
    store.set('note', 'Make room for the work that matters.')
  }
  stores.set(key, store)
  return store
}

async function previewStats(): Promise<WidgetSystemStats> {
  const now = Date.now()
  if (cachedStats && now - lastStatsAt < 2_000) {
    return cachedStats
  }
  if (statsRequest) {
    return statsRequest
  }
  statsRequest = window.api
    .getPreviewStats()
    .then((stats) => {
      cachedStats = stats
      lastStatsAt = Date.now()
      return stats
    })
    .catch(() => cachedStats ?? DEMO_STATS)
    .finally(() => {
      statsRequest = null
    })
  return statsRequest
}

function demoGridState(): AppGridState {
  return {
    widgetId: 'preview',
    title: 'Quick launch',
    apps: DEMO_APPS,
    items: [
      { key: `app:${DEMO_APPS[0]!.id}`, type: 'app', app: DEMO_APPS[0]! },
      { key: `app:${DEMO_APPS[1]!.id}`, type: 'app', app: DEMO_APPS[1]! },
      {
        key: 'bundle:preview-bundle',
        type: 'bundle',
        bundle: {
          id: 'preview-bundle',
          name: 'Utilities',
          apps: [DEMO_APPS[2]!, DEMO_APPS[3]!, DEMO_APPS[4]!]
        }
      },
      { key: `app:${DEMO_APPS[5]!.id}`, type: 'app', app: DEMO_APPS[5]! }
    ]
  }
}

function failure(code: WidgetApiErrorCode, message: string): object {
  return { ok: false, error: { code, message } }
}

function previewUrl(
  source: PreviewSource,
  dark: boolean,
  appearanceToken: string | null,
  env?: string
): string {
  const url =
    source.kind === 'builtin'
      ? new URL(`widget://_builtins/${source.type}/index.html`)
      : new URL(`widget://${source.id}/index.html`)
  if (source.variant) {
    url.searchParams.set('variant', source.variant)
  }
  if (source.kind === 'builtin' && env) {
    url.searchParams.set('env', env)
  }
  url.searchParams.set('preview', '1')
  url.searchParams.set('theme', dark ? 'dark' : 'light')
  if (appearanceToken) {
    url.searchParams.set('appearance', appearanceToken)
  }
  return url.toString()
}

function weatherResponse(url: string): object {
  if (url.includes('geocoding-api.open-meteo.com')) {
    return {
      ok: true,
      status: 200,
      text: JSON.stringify({
        results: [{ name: 'Lisbon', country_code: 'PT', latitude: 38.7223, longitude: -9.1393 }]
      })
    }
  }
  return {
    ok: true,
    status: 200,
    text: JSON.stringify({ current: { temperature_2m: 21, weather_code: 2 } })
  }
}

export default function WidgetPreview({
  source,
  width,
  height,
  dark,
  cursorStyle,
  env,
  appearance,
  assetWidgetId,
  title,
  interactive = false,
  className
}: WidgetPreviewProps): JSX.Element {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const appearanceRef = useRef(appearance)
  const darkRef = useRef(dark)
  const liveCssRef = useRef<string | null>(null)
  const [scale, setScale] = useState(1)
  const [appearanceToken, setAppearanceToken] = useState<string | null>(null)
  const key = previewKey(source)
  const hasAppearance = Boolean(appearance)
  const activeAppearanceToken = appearance ? appearanceToken : null
  const src = useMemo(
    () => previewUrl(source, dark, activeAppearanceToken, env),
    [activeAppearanceToken, dark, env, source]
  )
  const liveCss = useMemo(() => {
    if (!appearance) {
      return null
    }
    const background = appearance.bgImage
    const resolved =
      assetWidgetId && background && !background.startsWith('data:')
        ? { ...appearance, bgImage: `widget://${assetWidgetId}/${background}` }
        : appearance
    return hasCustomAppearance(resolved) ? appearanceCss(resolved) : ''
  }, [appearance, assetWidgetId])

  useEffect(() => {
    appearanceRef.current = appearance
  }, [appearance])

  useEffect(() => {
    darkRef.current = dark
  }, [dark])

  useEffect(() => {
    liveCssRef.current = liveCss
  }, [liveCss])

  useEffect(() => {
    const initial = appearanceRef.current
    if (!initial) {
      return
    }
    let cancelled = false
    let token: string | null = null
    void window.api
      .createWidgetPreview(initial, darkRef.current ? 'dark' : 'light', assetWidgetId)
      .then((created) => {
        token = created
        if (!cancelled) {
          setAppearanceToken(created)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (token) {
        void window.api.releaseWidgetPreview(token)
      }
    }
  }, [assetWidgetId, hasAppearance])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || liveCss === null) {
      return
    }
    frame.contentWindow?.postMessage({ type: 'hl-appearance', css: liveCss }, '*')
  }, [liveCss])

  useEffect(() => {
    const node = wrapRef.current
    if (!node) {
      return
    }
    const update = (): void => {
      const rect = node.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }
      setScale(Math.min(rect.width / width, rect.height / height))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [height, width])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) {
      return
    }

    const onLoad = (): void => {
      const store = seededStore(key)
      const channel = new MessageChannel()
      const port = channel.port1
      port.onmessage = (event: MessageEvent) => {
        const request = event.data as {
          id?: unknown
          method?: unknown
          params?: Record<string, unknown>
        } | null
        if (!request || typeof request.id !== 'number' || typeof request.method !== 'string') {
          return
        }
        const params = request.params ?? {}
        const respond = (result: unknown): void => {
          port.postMessage({ id: request.id, ok: true, result })
        }
        const reject = (code: WidgetApiErrorCode, message: string): void => {
          port.postMessage({ id: request.id, ...failure(code, message) })
        }

        switch (request.method) {
          case 'ready':
          case 'log':
            respond(null)
            return
          case 'getContext': {
            const context: WidgetContext = {
              width,
              height,
              dark,
              locale: navigator.language,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
            respond(context)
            return
          }
          case 'system.getStats':
            void previewStats().then(respond)
            return
          case 'system.getBattery':
            respond({ level: 0.82, charging: true })
            return
          case 'storage.get':
            respond(store.get(String(params['key'])) ?? null)
            return
          case 'storage.set':
            store.set(String(params['key']), params['value'])
            respond(true)
            return
          case 'storage.remove':
            store.delete(String(params['key']))
            respond(true)
            return
          case 'storage.keys':
            respond([...store.keys()])
            return
          case 'net.fetch':
            respond(weatherResponse(String(params['url'] ?? '')))
            return
          case 'apps.list':
          case 'apps.refresh':
            respond(DEMO_APPS)
            return
          case 'grid.getState':
            respond(demoGridState())
            return
          case 'grid.renameTitle':
          case 'grid.addApps':
          case 'grid.removeApp':
          case 'grid.move':
          case 'grid.merge':
            respond(demoGridState())
            return
          case 'grid.openBundle':
          case 'launch.app':
          case 'openLink':
            respond({ ok: true })
            return
          default:
            reject('invalid_args', 'This action is not available in preview.')
        }
      }
      if (typeof port.start === 'function') {
        port.start()
      }
      frame.contentWindow?.postMessage({ type: 'hl-init' }, '*', [channel.port2])
      if (liveCssRef.current !== null) {
        frame.contentWindow?.postMessage({ type: 'hl-appearance', css: liveCssRef.current }, '*')
      }
    }

    frame.addEventListener('load', onLoad)
    return () => frame.removeEventListener('load', onLoad)
  }, [dark, height, key, width])

  return (
    <div
      className={`widget-preview${className ? ` ${className}` : ''}`}
      data-preview-theme={dark ? 'dark' : 'light'}
      data-cursor={cursorStyle}
      style={{ aspectRatio: `${width} / ${height}` }}
      ref={wrapRef}
      aria-label={title}
    >
      <div
        className="widget-preview-stage"
        style={{
          width,
          height,
          transform: `translate(-50%, -50%) scale(${scale})`
        }}
      >
        <iframe
          ref={frameRef}
          src={appearance && !appearanceToken ? 'about:blank' : src}
          title={title}
          sandbox="allow-scripts"
          loading="lazy"
          tabIndex={interactive ? 0 : -1}
          style={{ pointerEvents: interactive ? 'auto' : 'none' }}
        />
      </div>
    </div>
  )
}
