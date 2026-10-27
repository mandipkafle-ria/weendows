import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  injectSdk,
  isWallpaperHost,
  mimeFor,
  resolveWidgetFile,
  type WidgetProtocolPaths
} from '../../src/main/protocol/widget-paths'

const paths: WidgetProtocolPaths = {
  widgetsDir: resolve('test-widgets'),
  sdkDir: resolve('test-sdk'),
  fontsDir: resolve('test-fonts')
}

describe('resolveWidgetFile', () => {
  it('maps a widget host to its index', () => {
    expect(resolveWidgetFile(paths, 'widget://clock')).toBe(
      join(paths.widgetsDir, 'clock', 'index.html')
    )
  })

  it('serves nested widget files', () => {
    expect(resolveWidgetFile(paths, 'widget://clock/scripts/app.js')).toBe(
      join(paths.widgetsDir, 'clock', 'scripts', 'app.js')
    )
  })

  it('normalizes dot segments inside a widget', () => {
    expect(resolveWidgetFile(paths, 'widget://clock/sub/../index.html')).toBe(
      join(paths.widgetsDir, 'clock', 'index.html')
    )
    expect(resolveWidgetFile(paths, 'widget://clock/../other/index.html')).toBe(
      join(paths.widgetsDir, 'clock', 'other', 'index.html')
    )
  })

  it('serves the SDK and fonts from reserved hosts', () => {
    expect(resolveWidgetFile(paths, 'widget://_sdk/sdk.js')).toBe(join(paths.sdkDir, 'sdk.js'))
    expect(resolveWidgetFile(paths, 'widget://_fonts/DotGothic16-Regular.woff2')).toBe(
      join(paths.fontsDir, 'DotGothic16-Regular.woff2')
    )
  })

  it('rejects encoded traversal outside the widget root', () => {
    expect(resolveWidgetFile(paths, 'widget://clock/%2F..%2F..%2Fsecret.txt')).toBeNull()
    expect(resolveWidgetFile(paths, 'widget://clock/%2e%2e%2f%2e%2e%2fsecret.txt')).toBeNull()
    expect(resolveWidgetFile(paths, 'widget://_sdk/%2F..%2F..%2Fsecret.txt')).toBeNull()
  })

  it('rejects invalid hosts and schemes', () => {
    expect(resolveWidgetFile(paths, 'widget://bad_host/index.html')).toBeNull()
    expect(resolveWidgetFile(paths, 'file:///C:/Windows/win.ini')).toBeNull()
    expect(resolveWidgetFile(paths, 'not a url')).toBeNull()
  })

  it('rejects malformed escapes', () => {
    expect(resolveWidgetFile(paths, 'widget://clock/%E0%A4%A')).toBeNull()
  })
})

describe('HTML wallpaper hosts', () => {
  const wallpaperPaths: WidgetProtocolPaths = {
    ...paths,
    wallpapersDir: resolve('test-wallpapers')
  }

  it('maps a wp- host into the wallpaper library', () => {
    expect(isWallpaperHost('wp-aurora')).toBe(true)
    expect(isWallpaperHost('clock')).toBe(false)
    expect(resolveWidgetFile(wallpaperPaths, 'widget://wp-aurora')).toBe(
      join(wallpaperPaths.wallpapersDir ?? '', 'aurora', 'index.html')
    )
    expect(resolveWidgetFile(wallpaperPaths, 'widget://wp-aurora/assets/bg.png')).toBe(
      join(wallpaperPaths.wallpapersDir ?? '', 'aurora', 'assets', 'bg.png')
    )
  })

  it('rejects invalid wallpaper ids and missing wallpaper roots', () => {
    expect(resolveWidgetFile(wallpaperPaths, 'widget://wp-../index.html')).toBeNull()
    expect(resolveWidgetFile(paths, 'widget://wp-aurora/index.html')).toBeNull()
  })
})

describe('built-in preview hosts', () => {
  const previewPaths: WidgetProtocolPaths = {
    ...paths,
    builtinsDir: resolve('test-builtins')
  }

  it('maps a _builtins host into the bundled widget library', () => {
    expect(resolveWidgetFile(previewPaths, 'widget://_builtins/clock/index.html')).toBe(
      join(previewPaths.builtinsDir ?? '', 'clock', 'index.html')
    )
    expect(resolveWidgetFile(previewPaths, 'widget://_builtins/weather/assets/icon.svg')).toBe(
      join(previewPaths.builtinsDir ?? '', 'weather', 'assets', 'icon.svg')
    )
  })

  it('requires a valid built-in type and root', () => {
    expect(resolveWidgetFile(previewPaths, 'widget://_builtins')).toBeNull()
    expect(resolveWidgetFile(previewPaths, 'widget://_builtins/index.html')).toBeNull()
    expect(resolveWidgetFile(previewPaths, 'widget://_builtins/Clock')).toBeNull()
    expect(resolveWidgetFile(previewPaths, 'widget://_builtins/clock/..%2F..%2Fsecret')).toBeNull()
    expect(resolveWidgetFile(paths, 'widget://_builtins/clock')).toBeNull()
  })
})

describe('mimeFor', () => {
  it('returns known content types', () => {
    expect(mimeFor('index.html')).toBe('text/html; charset=utf-8')
    expect(mimeFor('sdk.js')).toBe('text/javascript; charset=utf-8')
    expect(mimeFor('font.woff2')).toBe('font/woff2')
  })

  it('falls back for unknown types', () => {
    expect(mimeFor('archive.bin')).toBe('application/octet-stream')
  })
})

describe('injectSdk', () => {
  it('injects the SDK after the head tag and transparency style before its close', () => {
    const html = '<!doctype html><html><head><title>x</title></head><body></body></html>'
    expect(injectSdk(html)).toBe(
      '<!doctype html><html><head><script src="widget://_sdk/sdk.js"></script><title>x</title><style>html, body, :root { background: transparent !important; color-scheme: normal !important; }</style></head><body></body></html>'
    )
  })

  it('prepends the SDK and transparency style when there is no head tag', () => {
    expect(injectSdk('<p>hello</p>')).toBe(
      '<script src="widget://_sdk/sdk.js"></script><style>html, body, :root { background: transparent !important; color-scheme: normal !important; }</style><p>hello</p>'
    )
  })

  it('removes a legacy color-scheme meta tag', () => {
    const html =
      '<!doctype html><html><head><meta name="color-scheme" content="dark" /><title>x</title></head><body></body></html>'
    const injected = injectSdk(html)
    expect(injected).not.toContain('name="color-scheme"')
    expect(injected).toContain('<title>x</title>')
  })
})
