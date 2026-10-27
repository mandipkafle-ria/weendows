function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function waitForEvent(
  target: HTMLVideoElement,
  event: 'loadeddata' | 'seeked',
  timeoutMs = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for video ${event}`))
    }, timeoutMs)

    const cleanup = (): void => {
      window.clearTimeout(timeout)
      target.removeEventListener(event, onEvent)
      target.removeEventListener('error', onError)
    }
    const onEvent = (): void => {
      cleanup()
      resolve()
    }
    const onError = (): void => {
      cleanup()
      reject(new Error(target.error?.message || 'Video could not be decoded'))
    }

    target.addEventListener(event, onEvent, { once: true })
    target.addEventListener('error', onError, { once: true })
  })
}

async function captureWallpaperFrame(): Promise<string> {
  const file = new URLSearchParams(window.location.search).get('file')
  if (!file) {
    throw new Error('Missing video path')
  }

  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.playsInline = true
  video.src = file
  document.body.append(video)

  try {
    if (video.readyState < 2) {
      await waitForEvent(video, 'loadeddata')
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const target = duration > 1 ? 1 : 0
    if (target > 0) {
      video.currentTime = target
      await waitForEvent(video, 'seeked')
    }

    const width = video.videoWidth || 640
    const height = video.videoHeight || 360
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create a canvas context')
    }
    context.drawImage(video, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  } catch (error) {
    throw new Error(`Could not capture video frame: ${messageOf(error)}`, { cause: error })
  } finally {
    video.remove()
  }
}

declare global {
  interface Window {
    __captureWallpaperFrame?: () => Promise<string>
  }
}

window.__captureWallpaperFrame = captureWallpaperFrame

export {}
