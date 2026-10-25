import './style.css'
import { WIDGET_ID_RE } from '../../shared/constants'

const root = document.getElementById('root')
const rawId = new URLSearchParams(location.search).get('id') ?? ''
const widgetId = rawId.toLowerCase()

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
  root.replaceChildren(frame)
}
