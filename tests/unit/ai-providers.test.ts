import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeminiProvider } from '../../src/main/services/providers/gemini'
import { OpenAiCompatProvider } from '../../src/main/services/providers/openai-compat'
import { ProviderError, validateProviderBaseUrl } from '../../src/main/services/providers/types'

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  })
}

function signal(): AbortSignal {
  return new AbortController().signal
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GeminiProvider', () => {
  it('sends the expected request and joins reply parts', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'hello ' }, { text: 'world' }] } }]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const text = await new GeminiProvider().generate({
      baseUrl: 'https://example.com/v1beta',
      model: 'gemini-test',
      key: 'secret',
      system: 'system text',
      user: 'user text',
      signal: signal()
    })

    expect(text).toBe('hello world')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://example.com/v1beta/models/gemini-test:generateContent')
    expect(init?.redirect).toBe('error')
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('secret')
    const body = JSON.parse(String(init?.body)) as {
      systemInstruction: { parts: Array<{ text: string }> }
      contents: Array<{ role: string; parts: Array<{ text: string }> }>
    }
    expect(body.systemInstruction.parts[0]?.text).toBe('system text')
    expect(body.contents[0]?.parts[0]?.text).toBe('user text')
  })

  it('reports a blocked reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }))
    )

    await expect(
      new GeminiProvider().generate({
        baseUrl: 'https://example.com/v1beta',
        model: 'gemini-test',
        key: 'secret',
        system: 's',
        user: 'u',
        signal: signal()
      })
    ).rejects.toMatchObject({ kind: 'blocked' })
  })

  it('maps auth and rate limit errors', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': '7' }))
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new GeminiProvider()
    await expect(
      adapter.generate({
        baseUrl: 'https://example.com/v1beta',
        model: 'gemini-test',
        key: 'secret',
        system: 's',
        user: 'u',
        signal: signal()
      })
    ).rejects.toBeInstanceOf(ProviderError)

    await expect(
      adapter.generate({
        baseUrl: 'https://example.com/v1beta',
        model: 'gemini-test',
        key: 'secret',
        system: 's',
        user: 'u',
        signal: signal()
      })
    ).rejects.toMatchObject({ kind: 'rate_limited', retryAfter: '7' })
  })

  it('lists models that support generateContent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({
          models: [
            { name: 'models/a', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/b', supportedGenerationMethods: ['embedContent'] }
          ]
        })
      )
    )

    const models = await new GeminiProvider().listModels({
      baseUrl: 'https://example.com/v1beta',
      key: 'secret',
      signal: signal()
    })
    expect(models).toEqual(['a'])
  })
})

describe('OpenAiCompatProvider', () => {
  it('uses chat completions and omits auth for a local keyless base', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ choices: [{ message: { content: 'reply text' } }] })
    )
    vi.stubGlobal('fetch', fetchMock)

    const text = await new OpenAiCompatProvider().generate({
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama-test',
      key: '',
      system: 's',
      user: 'u',
      signal: signal()
    })

    expect(text).toBe('reply text')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://localhost:11434/v1/chat/completions')
    expect((init?.headers as Record<string, string>).authorization).toBeUndefined()
    const body = JSON.parse(String(init?.body)) as { model: string; messages: unknown[] }
    expect(body.model).toBe('llama-test')
    expect(body.messages).toHaveLength(2)
  })

  it('sends a bearer token for a remote base and lists models', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ data: [{ id: 'model-a' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const models = await new OpenAiCompatProvider().listModels({
      baseUrl: 'https://api.example.com/v1',
      key: 'secret',
      signal: signal()
    })
    expect(models).toEqual(['model-a'])
    const [, init] = fetchMock.mock.calls[0]!
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer secret')
  })
})

describe('validateProviderBaseUrl', () => {
  it('accepts https and localhost http', () => {
    expect(validateProviderBaseUrl('gemini', 'https://example.com/v1beta')).toBe(
      'https://example.com/v1beta'
    )
    expect(validateProviderBaseUrl('openai-compat', 'http://localhost:11434/v1')).toBe(
      'http://localhost:11434/v1'
    )
  })

  it('rejects insecure remote URLs, credentials and Gemini http', () => {
    expect(() => validateProviderBaseUrl('openai-compat', 'http://example.com/v1')).toThrow()
    expect(() =>
      validateProviderBaseUrl('openai-compat', 'https://user:pass@example.com/v1')
    ).toThrow()
    expect(() => validateProviderBaseUrl('gemini', 'http://localhost:8080')).toThrow()
  })
})
