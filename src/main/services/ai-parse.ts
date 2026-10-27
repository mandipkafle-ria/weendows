import { isIP } from 'node:net'
import { aiManifestSchema } from '../../shared/schemas'
import { minimumSizeFor } from '../../shared/widget-size'
import type { AiManifest } from '../../shared/types'

export type ParseErrorCode =
  | 'missing_blocks'
  | 'missing_closing_tag'
  | 'invalid_json'
  | 'invalid_manifest'
  | 'invalid_html'
  | 'too_large'

export class ParseError extends Error {
  readonly code: ParseErrorCode
  readonly problems: string[]

  constructor(code: ParseErrorCode, message: string, problems: string[] = [message]) {
    super(message)
    this.name = 'ParseError'
    this.code = code
    this.problems = problems
  }
}

function strip(value: string): string {
  return value
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

function block(text: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(text)
  return match?.[1] ?? null
}

function hasOpening(text: string, tag: string): boolean {
  return new RegExp(`<${tag}>`, 'i').test(text)
}

function isPublicHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost')) {
    return false
  }
  if (isIP(host) !== 0) {
    return false
  }
  return host.includes('.')
}

export function parseWidgetReply(text: string): { manifest: AiManifest; html: string } {
  const manifestBlock = block(text, 'hl-manifest')
  const widgetBlock = block(text, 'hl-widget')

  if (!manifestBlock || !widgetBlock) {
    if (
      (hasOpening(text, 'hl-manifest') && !manifestBlock) ||
      (hasOpening(text, 'hl-widget') && !widgetBlock)
    ) {
      throw new ParseError(
        'missing_closing_tag',
        'The reply was cut off. Retry, or use a model with a longer output limit.'
      )
    }
    throw new ParseError(
      'missing_blocks',
      'The reply did not include the required manifest and widget blocks.'
    )
  }

  const manifestJson = strip(manifestBlock)
  let parsed: unknown
  try {
    parsed = JSON.parse(manifestJson)
  } catch {
    try {
      parsed = JSON.parse(manifestJson.replace(/,\s*([}\]])/g, '$1'))
    } catch {
      throw new ParseError('invalid_json', 'The manifest JSON was not valid.')
    }
  }

  const result = aiManifestSchema.safeParse(parsed)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'manifest'
      return `${path}: ${issue.message}`
    })
    throw new ParseError(
      'invalid_manifest',
      `The manifest did not pass validation: ${problems.join('; ')}`,
      problems
    )
  }

  const manifest: AiManifest = {
    ...result.data,
    ...minimumSizeFor(result.data.width, result.data.height, result.data)
  }
  const hosts = manifest.allowedHosts.filter((host) => !isPublicHost(host))
  if (hosts.length > 0) {
    const problems = hosts.map((host) => `allowedHosts: ${host} is not a public host name`)
    throw new ParseError('invalid_manifest', problems.join('; '), problems)
  }

  const html = strip(widgetBlock)
  if (html.length === 0) {
    throw new ParseError('invalid_html', 'The widget HTML was empty.')
  }
  if (Buffer.byteLength(html) > 150_000) {
    throw new ParseError('too_large', 'The widget HTML is larger than 150 KB.')
  }

  return { manifest, html }
}

function addUnique(items: string[], value: string): void {
  if (!items.includes(value)) {
    items.push(value)
  }
}

export function checkWidgetHtml(
  html: string,
  manifest: AiManifest
): { problems: string[]; warnings: string[] } {
  const problems: string[] = []
  const warnings: string[] = []

  if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
    addUnique(problems, 'Remove the external script src and inline the JavaScript.')
  }
  if (/<link\b[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\//i.test(html)) {
    addUnique(problems, 'Remove the external stylesheet link and inline the CSS.')
  }
  if (/@import\s+(?:url\()?["']?(?:https?:)?\/\//i.test(html)) {
    addUnique(problems, 'Remove the external @import and inline the CSS.')
  }
  if (/url\(\s*["']?(?:https?:)?\/\//i.test(html)) {
    addUnique(problems, 'Remove external url() resources and use CSS, data: or inline SVG.')
  }

  const forbiddenTag = /<(iframe|object|embed|base|form)\b/i.exec(html)?.[1]
  if (forbiddenTag) {
    addUnique(problems, `Remove the <${forbiddenTag.toLowerCase()}> tag.`)
  }
  if (/<meta\b[^>]*http-equiv\s*=/i.test(html)) {
    addUnique(problems, 'Remove the meta http-equiv tag.')
  }
  if (/\beval\s*\(/i.test(html)) {
    addUnique(problems, 'Remove eval().')
  }
  if (/\bnew\s+Function\s*\(/i.test(html)) {
    addUnique(problems, 'Remove new Function().')
  }
  if (/\bimport\s*\(/i.test(html)) {
    addUnique(problems, 'Remove dynamic import().')
  }
  if (/\b(?:import|export)\b[\s\S]{0,200}?\bfrom\s*["'](?:https?:)?\/\//i.test(html)) {
    addUnique(problems, 'Remove imports from external URLs.')
  }
  if (/\bXMLHttpRequest\b/i.test(html)) {
    addUnique(problems, 'Use hl.net.fetch instead of XMLHttpRequest.')
  }
  if (/(?<![.\w])fetch\s*\(/i.test(html) || /\bwindow\.fetch\s*\(/i.test(html)) {
    addUnique(problems, 'Use hl.net.fetch instead of a direct fetch() call.')
  }
  if (/\blocalStorage\b/i.test(html) || /\bsessionStorage\b/i.test(html)) {
    addUnique(problems, 'Use hl.storage instead of localStorage or sessionStorage.')
  }
  if (/\bdocument\.cookie\b/i.test(html)) {
    addUnique(problems, 'Remove document.cookie and use hl.storage.')
  }
  if (/\bindexedDB\b/i.test(html)) {
    addUnique(problems, 'Remove indexedDB and use hl.storage.')
  }
  if (/\bwindow\.open\s*\(/i.test(html)) {
    addUnique(problems, 'Remove window.open().')
  }
  if (/(?:window\.)?location\s*(?:=|\.href\s*=|\.assign\s*\(|\.replace\s*\()/i.test(html)) {
    addUnique(problems, 'Remove page navigation and location assignment.')
  }

  if (!/\bhl\.ready\s*\(/i.test(html)) {
    addUnique(warnings, 'Call hl.ready() once after the first render.')
  }

  const hasNetwork = manifest.permissions.includes('network')
  if (hasNetwork && manifest.allowedHosts.length === 0) {
    addUnique(
      problems,
      'The network permission needs at least one allowed host, or remove the network permission.'
    )
  }
  if (!hasNetwork && manifest.allowedHosts.length > 0) {
    addUnique(
      problems,
      'Add the network permission for the allowed hosts, or remove the allowed hosts.'
    )
  }

  return { problems, warnings }
}
