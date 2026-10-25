import './style.css'
import { WIDGET_ID_RE } from '../../shared/constants'
import type { ShellState } from '../../shared/types'

const root = document.getElementById('root')
const rawId = new URLSearchParams(location.search).get('id') ?? ''
const widgetId = rawId.toLowerCase()
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

if (!root) {
  throw new Error('Widget shell root missing')
} else if (!WIDGET_ID_RE.test(widgetId)) {
  showError('Invalid widget id')
} else {
  const frame = document.createElement('iframe')
  frame.id = 'widget-frame'
  frame.title = widgetId
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.src = `widget://${widgetId}/index.html`

  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  overlay.hidden = true
  overlay.innerHTML = `
    <div class="overlay-toolbar">
      <button type="button" class="overlay-button" data-action="settings" aria-label="Widget settings">${gearIcon}</button>
      <button type="button" class="overlay-button" data-action="remove" aria-label="Remove widget">${closeIcon}</button>
    </div>
    <div class="resize-handle" data-action="resize" aria-label="Resize widget"></div>
  `

  root.replaceChildren(frame, overlay)

  let state: ShellState | null = null
  let active: 'drag' | 'resize' | null = null

  function endPointer(): void {
    if (!active) {
      return
    }
    const kind = active
    active = null
    if (kind === 'drag') {
      window.shellApi.dragEnd()
    } else {
      window.shellApi.resizeEnd()
    }
  }

  function applyState(next: ShellState): void {
    state = next
    overlay.hidden = !next.editMode
    overlay.classList.toggle('locked', next.locked)
    if (!next.editMode) {
      endPointer()
    }
  }

  overlay.addEventListener('pointerdown', (event: PointerEvent) => {
    if (!state?.editMode || event.button !== 0) {
      return
    }
    const target = event.target as HTMLElement
    const action = target.closest<HTMLElement>('[data-action]')?.dataset['action']
    if (action === 'settings' || action === 'remove') {
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
    if (active === 'drag') {
      window.shellApi.dragStart()
    } else {
      window.shellApi.resizeStart()
    }
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
    if (action === 'settings') {
      window.shellApi.openSettings()
    } else if (action === 'remove') {
      window.shellApi.removeWidget()
    }
  })

  if (!window.shellApi) {
    showError('Widget bridge unavailable')
  } else {
    window.shellApi.onStateChanged(applyState)
    void window.shellApi
      .getState()
      .then(applyState)
      .catch(() => undefined)
  }
}
