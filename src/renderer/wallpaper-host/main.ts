import type { WallpaperFit } from '../../shared/types'

const root = document.getElementById('root')
const params = new URLSearchParams(location.search)
const type = params.get('type')
const src = params.get('src') ?? ''
const rawFit = params.get('fit')
const fit: WallpaperFit =
  rawFit === 'fill' || rawFit === 'fit' || rawFit === 'stretch' || rawFit === 'center'
    ? rawFit
    : 'fill'
const muted = params.get('muted') !== '0'

function showError(message: string): void {
  if (!root) return
  const node = document.createElement('div')
  node.textContent = message
  node.style.cssText =
    'display:grid;place-items:center;width:100%;height:100%;color:#f5f5f5;font:14px system-ui;background:#000'
  root.replaceChildren(node)
}

function objectFit(): string {
  if (fit === 'fit') return 'contain'
  if (fit === 'stretch') return 'fill'
  if (fit === 'center') return 'none'
  return 'cover'
}

function objectPosition(): string {
  return fit === 'center' ? 'center' : 'center'
}

if (!root) {
  throw new Error('Wallpaper host root missing')
} else if (!src) {
  showError('Wallpaper source missing')
} else if (type === 'video') {
  const video = document.createElement('video')
  video.autoplay = true
  video.loop = true
  video.muted = muted
  video.playsInline = true
  video.preload = 'auto'
  video.src = src
  video.style.objectFit = objectFit()
  video.style.objectPosition = objectPosition()
  root.replaceChildren(video)

  let paused = false
  const applyPaused = (): void => {
    if (paused) {
      video.pause()
      return
    }
    void video.play().catch(() => undefined)
  }

  video.addEventListener('loadedmetadata', applyPaused)
  video.addEventListener('canplay', applyPaused)

  window.wallpaperApi?.onEvent((event) => {
    if (event.type !== 'pause') return
    paused = event.paused
    applyPaused()
  })
} else if (type === 'html') {
  const frame = document.createElement('iframe')
  frame.title = 'HTML wallpaper'
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.setAttribute('referrerpolicy', 'no-referrer')
  frame.src = src
  root.replaceChildren(frame)

  let paused = false
  const sendPause = (): void => {
    frame.contentWindow?.postMessage({ type: 'hl-pause', paused }, '*')
  }
  frame.addEventListener('load', sendPause)

  window.wallpaperApi?.onEvent((event) => {
    if (event.type === 'pause') {
      paused = event.paused
      sendPause()
      return
    }
    if (event.type === 'mouse') {
      frame.contentWindow?.postMessage({ type: 'hl-mouse', x: event.x, y: event.y }, '*')
    }
  })
} else {
  showError('Unsupported wallpaper type')
}
