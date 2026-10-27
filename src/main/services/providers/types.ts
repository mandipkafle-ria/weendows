import type { AiProvider } from '../../../shared/types'

export type ProviderErrorKind =
  | 'auth'
  | 'model_not_found'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'bad_request'
  | 'blocked'
  | 'empty'

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind
  readonly retryAfter: string | null

  constructor(kind: ProviderErrorKind, message: string, retryAfter: string | null = null) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
    this.retryAfter = retryAfter
  }
}

export interface GenerateInput {
  baseUrl: string
  model: string
  key: string
  system: string
  user: string
  signal: AbortSignal
}

export interface ListModelsInput {
  baseUrl: string
  key: string
  signal: AbortSignal
}

export interface ProviderAdapter {
  readonly id: AiProvider
  generate: (input: GenerateInput) => Promise<string>
  listModels: (input: ListModelsInput) => Promise<string[]>
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

export function validateProviderBaseUrl(provider: AiProvider, raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error('The base URL is not valid.')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('The base URL must start with https:// or http://.')
  }
  if (url.username || url.password) {
    throw new Error('The base URL must not contain a username or password.')
  }
  if (url.search || url.hash) {
    throw new Error('The base URL must not contain a query string or fragment.')
  }

  const host = url.hostname.toLowerCase()
  const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
  if (url.protocol === 'http:' && !local) {
    throw new Error('The base URL must use https:// unless it points at localhost.')
  }
  if (provider === 'gemini' && url.protocol !== 'https:') {
    throw new Error('Google Gemini requires an https:// base URL.')
  }

  return url.toString().replace(/\/$/, '')
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

function retryAfterSuffix(value: string | null): string {
  if (!value) {
    return ''
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return ` Retry after ${Math.ceil(seconds)} seconds.`
  }
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return ` Retry after ${date.toISOString()}.`
  }
  return ''
}

function statusError(
  status: number,
  context: 'generate' | 'list',
  retryAfter: string | null
): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(
      'auth',
      'The key was rejected. Check that it is correct and has access to this model.'
    )
  }
  if (status === 404 && context === 'generate') {
    return new ProviderError(
      'model_not_found',
      'The model name was not found. Press Load models and choose one.'
    )
  }
  if (status === 429) {
    return new ProviderError(
      'rate_limited',
      `Rate limit reached on your plan. Wait and try again, or pick another model.${retryAfterSuffix(retryAfter)}`,
      retryAfter
    )
  }
  if (status >= 500) {
    return new ProviderError('server', 'The provider has a problem. Try again in a minute.')
  }
  if (status === 404 && context === 'list') {
    return new ProviderError(
      'bad_request',
      'The provider did not expose a model list. Check the base URL.'
    )
  }
  return new ProviderError(
    'bad_request',
    'The provider rejected the request. Check the model and base URL.'
  )
}

export async function fetchProviderJson(
  url: string,
  init: RequestInit,
  context: 'generate' | 'list'
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { ...init, redirect: 'error' })
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new ProviderError(
      'network',
      'No connection to the provider. For Ollama, check that it is running.'
    )
  }

  if (!response.ok) {
    throw statusError(response.status, context, response.headers.get('retry-after'))
  }

  let text: string
  try {
    text = await response.text()
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new ProviderError('network', 'The provider response could not be read.')
  }

  if (text.trim().length === 0) {
    throw new ProviderError(
      'empty',
      'The provider returned nothing usable. Try rewording the request.'
    )
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new ProviderError(
      'bad_request',
      'The provider returned an invalid response. Try again or choose another model.'
    )
  }
}

export function blockedReply(): ProviderError {
  return new ProviderError(
    'blocked',
    'The provider returned nothing usable. Try rewording the request.'
  )
}
