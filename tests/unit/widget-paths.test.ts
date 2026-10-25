import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  injectSdk,
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
  it('injects the SDK after the head tag', () => {
    const html = '<!doctype html><html><head><title>x</title></head><body></body></html>'
    expect(injectSdk(html)).toContain(
      '<head><script src="widget://_sdk/sdk.js"></script><title>x</title>'
    )
  })

  it('prepends the SDK when there is no head tag', () => {
    expect(injectSdk('<p>hello</p>')).toBe(
      '<script src="widget://_sdk/sdk.js"></script><p>hello</p>'
    )
  })
})
