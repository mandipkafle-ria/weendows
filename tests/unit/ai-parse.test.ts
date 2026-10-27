import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkWidgetHtml,
  parseWidgetReply,
  ParseError,
  type ParseErrorCode
} from '../../src/main/services/ai-parse'
import type { AiManifest } from '../../src/shared/types'

function fixture(name: string): string {
  return readFileSync(join(process.cwd(), 'tests', 'fixtures', 'ai', name), 'utf8')
}

function parseFailure(name: string): ParseError {
  try {
    parseWidgetReply(fixture(name))
  } catch (error) {
    if (error instanceof ParseError) {
      return error
    }
    throw error
  }
  throw new Error(`Expected ${name} to fail parsing`)
}

function expectCode(name: string, code: ParseErrorCode): ParseError {
  const error = parseFailure(name)
  expect(error.code).toBe(code)
  return error
}

describe('parseWidgetReply', () => {
  it('parses a complete reply', () => {
    const result = parseWidgetReply(fixture('valid-clock.txt'))
    expect(result.manifest.name).toBe('Tiny clock')
    expect(result.manifest.width).toBe(240)
    expect(result.manifest.minWidth).toBe(180)
    expect(result.manifest.minHeight).toBe(180)
    expect(result.html).toContain('hl.ready()')
  })

  it('raises a requested minimum below the readable floor', () => {
    const result = parseWidgetReply(
      '<hl-manifest>{"name":"Small","width":240,"height":240,"minWidth":120,"minHeight":120,"permissions":[],"allowedHosts":[]}</hl-manifest><hl-widget><html><body><script>hl.ready()</script></body></html></hl-widget>'
    )
    expect(result.manifest.minWidth).toBe(180)
    expect(result.manifest.minHeight).toBe(180)
  })

  it('keeps a larger minimum and clamps it to the design size', () => {
    const larger = parseWidgetReply(
      '<hl-manifest>{"name":"Larger","width":240,"height":240,"minWidth":220,"minHeight":230,"permissions":[],"allowedHosts":[]}</hl-manifest><hl-widget><html><body><script>hl.ready()</script></body></html></hl-widget>'
    )
    expect(larger.manifest.minWidth).toBe(220)
    expect(larger.manifest.minHeight).toBe(230)

    const clamped = parseWidgetReply(
      '<hl-manifest>{"name":"Clamped","width":240,"height":240,"minWidth":500,"minHeight":500,"permissions":[],"allowedHosts":[]}</hl-manifest><hl-widget><html><body><script>hl.ready()</script></body></html></hl-widget>'
    )
    expect(clamped.manifest.minWidth).toBe(240)
    expect(clamped.manifest.minHeight).toBe(240)
  })

  it('tolerates a trailing comma in the manifest', () => {
    const result = parseWidgetReply(fixture('trailing-comma.txt'))
    expect(result.manifest.name).toBe('Trailing comma')
  })

  it('tolerates fenced output and prose around the blocks', () => {
    expect(parseWidgetReply(fixture('fenced-output.txt')).manifest.name).toBe('Fenced clock')
    expect(parseWidgetReply(fixture('prose-around.txt')).manifest.name).toBe('Prose clock')
  })

  it('uses the first widget when the reply contains two', () => {
    expect(parseWidgetReply(fixture('two-widgets.txt')).manifest.name).toBe('First widget')
  })

  it('reports missing blocks', () => {
    expectCode('missing-widget.txt', 'missing_blocks')
  })

  it('reports a missing closing tag', () => {
    expectCode('missing-closing.txt', 'missing_closing_tag')
  })

  it('reports invalid JSON', () => {
    expectCode('invalid-json.txt', 'invalid_json')
  })

  it('reports invalid manifest fields', () => {
    const error = expectCode('bad-manifest.txt', 'invalid_manifest')
    expect(error.problems.some((problem) => problem.includes('width'))).toBe(true)
    expect(error.problems.some((problem) => problem.includes('permissions'))).toBe(true)
  })

  it('rejects private host names', () => {
    const error = expectCode('private-host.txt', 'invalid_manifest')
    expect(error.problems.join(' ')).toContain('not a public host')
  })

  it('rejects HTML larger than 150 KB', () => {
    const html = `<hl-manifest>{"name":"Huge","width":240,"height":240,"permissions":[],"allowedHosts":[]}</hl-manifest><hl-widget>${'x'.repeat(150_001)}</hl-widget>`
    expect(() => parseWidgetReply(html)).toThrow(ParseError)
  })
})

describe('checkWidgetHtml', () => {
  it('flags external scripts and remote CSS', () => {
    const { manifest, html } = parseWidgetReply(fixture('external-script.txt'))
    const checked = checkWidgetHtml(html, manifest)
    expect(checked.problems.some((problem) => problem.includes('external script'))).toBe(true)
  })

  it('flags forbidden tags and APIs', () => {
    const { manifest, html } = parseWidgetReply(fixture('forbidden-tags.txt'))
    const checked = checkWidgetHtml(html, manifest)
    const joined = checked.problems.join(' ')
    expect(joined).toContain('<iframe>')
    expect(joined).toContain('eval()')
    expect(joined).toContain('hl.storage')
  })

  it('flags direct fetch and external module imports', () => {
    const direct = parseWidgetReply(fixture('direct-fetch.txt'))
    expect(
      checkWidgetHtml(direct.html, direct.manifest).problems.some((problem) =>
        problem.includes('direct fetch')
      )
    ).toBe(true)

    const external = parseWidgetReply(fixture('external-import.txt'))
    expect(
      checkWidgetHtml(external.html, external.manifest).problems.some((problem) =>
        problem.includes('external URLs')
      )
    ).toBe(true)
  })

  it('allows hl.net.fetch', () => {
    const manifest: AiManifest = {
      name: 'Network widget',
      width: 240,
      height: 240,
      minWidth: 180,
      minHeight: 180,
      permissions: ['network'],
      allowedHosts: ['api.example.com'],
      refreshSeconds: null
    }
    const html =
      '<!doctype html><html><body><script>hl.net.fetch("https://api.example.com/data"); hl.ready()</script></body></html>'
    const checked = checkWidgetHtml(html, manifest)
    expect(checked.problems).toEqual([])
  })

  it('flags network permission without hosts', () => {
    const { manifest, html } = parseWidgetReply(fixture('network-mismatch.txt'))
    const checked = checkWidgetHtml(html, manifest)
    expect(checked.problems.some((problem) => problem.includes('allowed host'))).toBe(true)
  })

  it('warns when hl.ready() is missing', () => {
    const { manifest, html } = parseWidgetReply(fixture('no-ready.txt'))
    const checked = checkWidgetHtml(html, manifest)
    expect(checked.problems).toEqual([])
    expect(checked.warnings.some((warning) => warning.includes('hl.ready'))).toBe(true)
  })
})
