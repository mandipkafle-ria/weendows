import dns from 'node:dns'
import https from 'node:https'
import net from 'node:net'
import {
  WIDGET_NET_MAX_REDIRECTS,
  WIDGET_NET_MAX_RESPONSE_BYTES,
  WIDGET_NET_TIMEOUT_MS
} from '../../shared/constants'
import type { WidgetApiErrorCode } from '../../shared/types'
import log from './logger'

export class NetProxyError extends Error {
  readonly code: WidgetApiErrorCode

  constructor(code: WidgetApiErrorCode, message: string) {
    super(message)
    this.name = 'NetProxyError'
    this.code = code
  }
}

const blocked = new net.BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4]
] as const) {
  blocked.addSubnet(address, prefix, 'ipv4')
}
for (const [address, prefix] of [
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
] as const) {
  blocked.addSubnet(address, prefix, 'ipv6')
}

export function isBlockedAddress(address: string): boolean {
  const zone = address.indexOf('%')
  const clean = zone >= 0 ? address.slice(0, zone) : address
  const family = net.isIP(clean)
  if (family === 0) {
    return true
  }
  if (clean.toLowerCase().startsWith('::ffff:')) {
    return true
  }
  try {
    return blocked.check(clean, family === 6 ? 'ipv6' : 'ipv4')
  } catch {
    return true
  }
}

export type SafeLookupCallback = (
  error: NodeJS.ErrnoException | null,
  address?: string | dns.LookupAddress[],
  family?: number
) => void

export type SafeLookup = (
  hostname: string,
  options: dns.LookupOptions,
  callback: SafeLookupCallback
) => void

function blockedAddressError(): NodeJS.ErrnoException {
  const error = new Error('blocked address') as NodeJS.ErrnoException
  error.code = 'network_blocked'
  return error
}

export function createSafeLookup(lookup: typeof dns.lookup = dns.lookup): SafeLookup {
  return (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error)
        return
      }

      const list = Array.isArray(addresses) ? addresses : []
      if (list.length === 0 || list.some((entry) => isBlockedAddress(entry.address))) {
        callback(blockedAddressError())
        return
      }

      if (options.all) {
        callback(null, list)
        return
      }

      const first = list[0]
      if (!first) {
        callback(blockedAddressError())
        return
      }
      callback(null, first.address, first.family)
    })
  }
}

export const safeLookup = createSafeLookup()

function normalizedHostname(hostname: string): string {
  let host = hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }
  return host
}

export function isBlockedHostname(hostname: string): boolean {
  const host = normalizedHostname(hostname)
  return (
    host.length === 0 ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    net.isIP(host) !== 0
  )
}

export function hostIsAllowed(hostname: string, allowedHosts: readonly string[]): boolean {
  const host = normalizedHostname(hostname)
  return allowedHosts.some((allowed) => normalizedHostname(allowed) === host)
}

export function assertAllowedUrl(rawUrl: unknown, allowedHosts: readonly string[]): URL {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    throw new NetProxyError('invalid_args', 'url must be a string')
  }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new NetProxyError('invalid_args', 'url is not valid')
  }

  if (url.protocol !== 'https:') {
    throw new NetProxyError('network_blocked', 'only https is allowed')
  }
  if (url.username || url.password) {
    throw new NetProxyError('network_blocked', 'credentials in the url are not allowed')
  }
  if (isBlockedHostname(url.hostname)) {
    throw new NetProxyError('network_blocked', 'blocked host')
  }
  if (!hostIsAllowed(url.hostname, allowedHosts)) {
    throw new NetProxyError('network_blocked', 'host is not in allowedHosts')
  }

  return url
}

export interface NetFetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export interface NetFetchResult {
  ok: boolean
  status: number
  text: string
}

interface RequestOptions {
  method: 'GET' | 'POST'
  headers: Record<string, string>
  body?: string
}

const ALLOWED_HEADERS = new Set(['accept', 'content-type', 'authorization'])

function validateOptions(raw: unknown): NetFetchOptions {
  if (raw === undefined || raw === null) {
    return {}
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new NetProxyError('invalid_args', 'opts must be an object')
  }
  return raw as NetFetchOptions
}

function buildRequestOptions(raw: NetFetchOptions, userAgent: string): RequestOptions {
  const method = (raw.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'POST') {
    throw new NetProxyError('invalid_args', 'method must be GET or POST')
  }

  const headers: Record<string, string> = {}
  if (raw.headers !== undefined) {
    if (typeof raw.headers !== 'object' || raw.headers === null || Array.isArray(raw.headers)) {
      throw new NetProxyError('invalid_args', 'headers must be an object')
    }
    for (const [name, value] of Object.entries(raw.headers)) {
      if (!ALLOWED_HEADERS.has(name.toLowerCase())) {
        throw new NetProxyError('invalid_args', `header not allowed: ${name}`)
      }
      if (typeof value !== 'string') {
        throw new NetProxyError('invalid_args', 'header values must be strings')
      }
      headers[name] = value
    }
  }

  headers['User-Agent'] = userAgent

  let body: string | undefined
  if (raw.body !== undefined) {
    if (method !== 'POST') {
      throw new NetProxyError('invalid_args', 'body is only allowed for POST')
    }
    if (typeof raw.body !== 'string') {
      throw new NetProxyError('invalid_args', 'body must be a string')
    }
    body = raw.body
  }

  return { method, headers, body }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

export class NetProxy {
  private readonly userAgent: string
  private readonly lookup: SafeLookup

  constructor(userAgent: string, lookup: SafeLookup = safeLookup) {
    this.userAgent = userAgent
    this.lookup = lookup
  }

  async fetch(
    rawUrl: unknown,
    rawOptions: unknown,
    allowedHosts: readonly string[]
  ): Promise<NetFetchResult> {
    const url = assertAllowedUrl(rawUrl, allowedHosts)
    const options = buildRequestOptions(validateOptions(rawOptions), this.userAgent)
    return this.request(url, options, allowedHosts, 0, Date.now() + WIDGET_NET_TIMEOUT_MS)
  }

  private request(
    url: URL,
    options: RequestOptions,
    allowedHosts: readonly string[],
    redirects: number,
    deadline: number
  ): Promise<NetFetchResult> {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      return Promise.reject(new NetProxyError('timeout', 'Request timed out'))
    }

    return new Promise<NetFetchResult>((resolve, reject) => {
      let settled = false
      let timer: NodeJS.Timeout | null = null
      const finish = (error: NetProxyError | null, result?: NetFetchResult): void => {
        if (settled) {
          return
        }
        settled = true
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        if (error) {
          reject(error)
        } else if (result) {
          resolve(result)
        }
      }

      const request = https.request(
        url,
        {
          method: options.method,
          headers: options.headers,
          timeout: remaining,
          lookup: this.lookup as unknown as net.LookupFunction,
          agent: false
        },
        (response) => {
          const status = response.statusCode ?? 0
          const location = response.headers.location

          if (isRedirect(status) && typeof location === 'string') {
            response.resume()
            if (redirects >= WIDGET_NET_MAX_REDIRECTS) {
              finish(new NetProxyError('network_blocked', 'too many redirects'))
              return
            }

            let nextUrl: URL
            try {
              nextUrl = assertAllowedUrl(new URL(location, url).toString(), allowedHosts)
            } catch (error) {
              finish(
                error instanceof NetProxyError
                  ? error
                  : new NetProxyError('network_blocked', 'redirect blocked')
              )
              return
            }

            const nextHeaders = { ...options.headers }
            if (normalizedHostname(nextUrl.hostname) !== normalizedHostname(url.hostname)) {
              for (const name of Object.keys(nextHeaders)) {
                if (name.toLowerCase() === 'authorization') {
                  delete nextHeaders[name]
                }
              }
            }

            const switchToGet =
              status === 303 || ((status === 301 || status === 302) && options.method === 'POST')
            const nextOptions: RequestOptions = switchToGet
              ? { method: 'GET', headers: nextHeaders }
              : { method: options.method, headers: nextHeaders, body: options.body }

            void this.request(nextUrl, nextOptions, allowedHosts, redirects + 1, deadline).then(
              (result) => finish(null, result),
              (error: unknown) =>
                finish(
                  error instanceof NetProxyError
                    ? error
                    : new NetProxyError('internal', 'Network request failed')
                )
            )
            return
          }

          const chunks: Buffer[] = []
          let total = 0

          response.on('data', (chunk: Buffer) => {
            if (total >= WIDGET_NET_MAX_RESPONSE_BYTES) {
              return
            }
            const remainingBytes = WIDGET_NET_MAX_RESPONSE_BYTES - total
            const part = chunk.length > remainingBytes ? chunk.subarray(0, remainingBytes) : chunk
            chunks.push(part)
            total += part.length
            if (total >= WIDGET_NET_MAX_RESPONSE_BYTES) {
              response.destroy()
              finish(null, {
                ok: status >= 200 && status < 300,
                status,
                text: Buffer.concat(chunks).toString('utf8')
              })
            }
          })

          response.on('end', () => {
            finish(null, {
              ok: status >= 200 && status < 300,
              status,
              text: Buffer.concat(chunks).toString('utf8')
            })
          })

          response.on('error', () => {
            finish(new NetProxyError('internal', 'Network response failed'))
          })
        }
      )

      timer = setTimeout(() => {
        request.destroy()
        finish(new NetProxyError('timeout', 'Request timed out'))
      }, remaining)

      request.on('timeout', () => {
        request.destroy()
        finish(new NetProxyError('timeout', 'Request timed out'))
      })

      request.on('error', (error: NodeJS.ErrnoException) => {
        if (settled) {
          return
        }
        if (error instanceof NetProxyError) {
          finish(error)
        } else if (error.code === 'network_blocked' || error.message === 'blocked address') {
          finish(new NetProxyError('network_blocked', 'blocked address'))
        } else {
          log.warn('Widget network request failed', {
            host: url.hostname,
            code: error.code,
            message: error.message
          })
          finish(new NetProxyError('internal', 'Network request failed'))
        }
      })

      if (options.body !== undefined) {
        request.write(options.body)
      }
      request.end()
    })
  }
}
