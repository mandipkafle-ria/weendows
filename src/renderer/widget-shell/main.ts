import './style.css'
import {
  WIDGET_API_METHOD_MAX,
  WIDGET_API_PARAMS_MAX_BYTES,
  WIDGET_HEARTBEAT_INTERVAL_MS,
  WIDGET_HEARTBEAT_TIMEOUT_MS,
  WIDGET_ID_RE
} from '../../shared/constants'
import type {
  ShellBatterySnapshot,
  ShellState,
  WidgetApiErrorCode,
  WidgetApiResponse,
  WidgetEvent
} from '../../shared/types'
import { t } from '../i18n'

const root = document.getElementById('root')
const params = new URLSearchParams(location.search)
const rawId = params.get('id') ?? ''
const widgetId = rawId.toLowerCase()
const widgetVariant = params.get('variant')
const gearIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.5-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.3 2.6a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5Z"/><circle cx="12" cy="12" r="2.6"/></svg>'
const closeIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'

function showError(message: string): void {
  if (!root) return
  const node = document.createElement('div')
  node.className = 'shell-error'
  node.textContent = message
  root.replaceChildren(node)
}

function errorResponse(code: WidgetApiErrorCode, message: string): WidgetApiResponse {
  return { ok: false, error: { code, message } }
}

async function readBattery(): Promise<ShellBatterySnapshot | null> {
  const navigatorWithBattery = navigator as Navigator & {
    getBattery?: () => Promise<{ level: number; charging: boolean }>
  }
  if (typeof navigatorWithBattery.getBattery !== 'function') {
    return null
  }

  try {
    const battery = await Promise.race([
      navigatorWithBattery.getBattery(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
    ])
    if (!battery) {
      return null
    }
    return { level: battery.level, charging: battery.charging }
  } catch {
    return null
  }
}

if (!root) {
  throw new Error('Widget shell root missing')
} else if (!WIDGET_ID_RE.test(widgetId)) {
  showError(t('shell.invalidId'))
} else if (!window.shellApi) {
  showError(t('shell.bridgeUnavailable'))
} else {
  const frame = document.createElement('iframe')
  frame.id = 'widget-frame'
  frame.title = widgetId
  frame.setAttribute('sandbox', 'allow-scripts')

  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  overlay.hidden = true
  overlay.innerHTML = `
    <div class="overlay-drag" data-action="drag" aria-label="${t('shell.moveWidget')}"></div>
    <div class="overlay-toolbar">
      <button type="button" class="overlay-button" data-action="edit-ai" aria-label="${t('shell.editWithAi')}">${gearIcon}</button>
      <button type="button" class="overlay-button" data-action="remove" aria-label="${t('shell.removeWidget')}">${closeIcon}</button>
    </div>
    <div class="resize-handle" data-action="resize" aria-label="${t('shell.resizeWidget')}"></div>
  `

  root.replaceChildren(frame, overlay)

  let state: ShellState | null = null
  let active: 'drag' | 'resize' | null = null
  let port: MessagePort | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let lastPong = 0
  let pingId = 0
  let unresponsive = false

  function stopHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function markResponsive(): void {
    if (!unresponsive) {
      return
    }
    unresponsive = false
    void window.shellApi.invoke('widget-responsive')
  }

  function startHeartbeat(activePort: MessagePort): void {
    stopHeartbeat()
    lastPong = Date.now()
    heartbeatTimer = setInterval(() => {
      if (port !== activePort) {
        return
      }
      if (Date.now() - lastPong > WIDGET_HEARTBEAT_TIMEOUT_MS) {
        if (!unresponsive) {
          unresponsive = true
          void window.shellApi.invoke('widget-unresponsive')
        }
        return
      }
      activePort.postMessage({ type: 'hl-ping', id: ++pingId })
    }, WIDGET_HEARTBEAT_INTERVAL_MS)
  }

  function endPointer(): void {
    if (!active) {
      return
    }
    const kind = active
    active = null
    void window.shellApi.invoke(kind === 'drag' ? 'drag-end' : 'resize-end')
  }

  function applyState(next: ShellState): void {
    state = next
    overlay.hidden = !next.editMode
    overlay.classList.toggle('locked', next.locked)
    overlay.classList.toggle('passthrough', next.editPassthrough)
    frame.style.opacity = String(next.opacity)
    document.documentElement.dataset['cursor'] = next.cursorStyle
    if (!next.editMode) {
      endPointer()
    }
  }

  function postWidgetEvent(event: WidgetEvent): void {
    if (port) {
      port.postMessage({ event: event.event, data: event.data })
    }
  }

  async function handleWidgetCall(activePort: MessagePort, raw: unknown): Promise<void> {
    if (!raw || typeof raw !== 'object') {
      return
    }

    const request = raw as { id?: unknown; method?: unknown; params?: unknown }
    if (typeof request.id !== 'number') {
      return
    }
    if (
      typeof request.method !== 'string' ||
      request.method.length === 0 ||
      request.method.length > WIDGET_API_METHOD_MAX
    ) {
      activePort.postMessage({ id: request.id, ...errorResponse('invalid_args', 'invalid method') })
      return
    }

    let serializedParams: string
    try {
      serializedParams = JSON.stringify(request.params === undefined ? null : request.params)
    } catch {
      activePort.postMessage({
        id: request.id,
        ...errorResponse('invalid_args', 'params must be JSON')
      })
      return
    }
    if (new TextEncoder().encode(serializedParams).length > WIDGET_API_PARAMS_MAX_BYTES) {
      activePort.postMessage({
        id: request.id,
        ...errorResponse('too_large', 'params are larger than 64 KB')
      })
      return
    }

    let shellBattery: ShellBatterySnapshot | null = null
    if (request.method === 'system.getBattery') {
      shellBattery = await readBattery()
    }

    let response: WidgetApiResponse
    try {
      response = (await window.shellApi.invoke('widget-api', {
        method: request.method,
        params: request.params,
        shellBattery
      })) as WidgetApiResponse
    } catch {
      response = errorResponse('internal', t('shell.apiUnavailable'))
    }

    if (activePort === port) {
      activePort.postMessage({ id: request.id, ...response })
    }
  }

  function setupBridge(): void {
    frame.addEventListener('load', () => {
      stopHeartbeat()
      if (port) {
        port.close()
        port = null
      }
      markResponsive()

      const channel = new MessageChannel()
      const activePort = channel.port1
      port = activePort
      activePort.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: unknown } | null
        if (data && data.type === 'hl-pong') {
          lastPong = Date.now()
          markResponsive()
          return
        }
        void handleWidgetCall(activePort, event.data)
      }
      if (typeof activePort.start === 'function') {
        activePort.start()
      }
      startHeartbeat(activePort)

      try {
        frame.contentWindow?.postMessage({ type: 'hl-init' }, '', [channel.port2])
      } catch {
        frame.contentWindow?.postMessage({ type: 'hl-init' }, '*', [channel.port2])
      }
    })
  }

  overlay.addEventListener('pointerdown', (event: PointerEvent) => {
    if (!state?.editMode || event.button !== 0) {
      return
    }
    const target = event.target as HTMLElement
    const action = target.closest<HTMLElement>('[data-action]')?.dataset['action']
    if (action === 'edit-ai' || action === 'remove') {
      return
    }
    if (state.locked) {
      return
    }

    event.preventDefault()
    active = action === 'resize' ? 'resize' : 'drag'
    try {
      overlay.setPointerCapture(event.pointerId)
    } catch {
      active = null
      return
    }
    void window.shellApi.invoke(active === 'drag' ? 'drag-start' : 'resize-start')
  })

  overlay.addEventListener('pointerup', (event: PointerEvent) => {
    if (!active) {
      return
    }
    endPointer()
    if (overlay.hasPointerCapture(event.pointerId)) {
      overlay.releasePointerCapture(event.pointerId)
    }
  })

  overlay.addEventListener('pointercancel', () => endPointer())
  overlay.addEventListener('lostpointercapture', () => endPointer())
  window.addEventListener('blur', () => endPointer())
  document.addEventListener('dragstart', (event) => event.preventDefault())
  document.addEventListener('contextmenu', (event) => {
    if (state?.editMode) {
      event.preventDefault()
    }
  })

  overlay.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target) {
      return
    }
    event.stopPropagation()
    const action = target.dataset['action']
    if (action === 'edit-ai') {
      void window.shellApi.invoke('edit-with-ai')
    } else if (action === 'remove') {
      void window.shellApi.invoke('remove-widget')
    }
  })

  window.shellApi.on((event) => {
    if (event.type === 'state') {
      applyState(event.state)
      return
    }
    postWidgetEvent(event.event)
  })

  window.addEventListener('beforeunload', stopHeartbeat)
  setupBridge()
  const frameUrl = new URL(`widget://${widgetId}/index.html`)
  if (widgetVariant) {
    frameUrl.searchParams.set('variant', widgetVariant)
  }
  frame.src = frameUrl.toString()

  void window.shellApi
    .invoke('get-state')
    .then((next) => applyState(next as ShellState))
    .catch(() => undefined)
}
