import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
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
  appearance?: WidgetAppearance
  assetWidgetId?: string
  title: string
  interactive?: boolean
  className?: string
}

const DEMO_APPS: AppEntry[] = [
  { id: 'preview-browser', name: 'Browser', kind: 'lnk', hidden: false, iconUrl: null },
  { id: 'preview-files', name: 'Files', kind: 'lnk', hidden: false, iconUrl: null },
  { id: 'preview-music', name: 'Music', kind: 'lnk', hidden: false, iconUrl: null },
  { id: 'preview-terminal', name: 'Terminal', kind: 'lnk', hidden: false, iconUrl: null },
  { id: 'preview-notes', name: 'Notes', kind: 'lnk', hidden: false, iconUrl: null },
  { id: 'preview-settings', name: 'Settings', kind: 'uwp', hidden: false, iconUrl: null }
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

function previewUrl(source: PreviewSource, dark: boolean, appearanceToken: string | null): string {
  const url =
    source.kind === 'builtin'
      ? new URL(`widget://_builtins/${source.type}/index.html`)
      : new URL(`widget://${source.id}/index.html`)
  if (source.variant) {
    url.searchParams.set('variant', source.variant)
  }
  url.searchParams.set('preview', '1')
  if (appearanceToken) {
    url.searchParams.set('appearance', appearanceToken)
    url.searchParams.set('theme', dark ? 'dark' : 'light')
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
  appearance,
  assetWidgetId,
  title,
  interactive = false,
  className
}: WidgetPreviewProps): JSX.Element {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [appearanceToken, setAppearanceToken] = useState<string | null>(null)
  const key = previewKey(source)
  const appearanceKey = useMemo(() => (appearance ? JSON.stringify(appearance) : ''), [appearance])
  const activeAppearanceToken = appearance ? appearanceToken : null
  const src = useMemo(
    () => previewUrl(source, dark, activeAppearanceToken),
    [activeAppearanceToken, dark, source]
  )

  useEffect(() => {
    if (!appearance) {
      return
    }
    let cancelled = false
    let token: string | null = null
    void window.api
      .createWidgetPreview(appearance, dark ? 'dark' : 'light', assetWidgetId)
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
  }, [appearance, appearanceKey, assetWidgetId, dark])

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
    }

    frame.addEventListener('load', onLoad)
    return () => frame.removeEventListener('load', onLoad)
  }, [dark, height, key, width])

  return (
    <div
      className={`widget-preview${className ? ` ${className}` : ''}`}
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
