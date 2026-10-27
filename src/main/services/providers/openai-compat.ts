import type { AiProvider } from '../../../shared/types'
import {
  blockedReply,
  fetchProviderJson,
  joinUrl,
  ProviderError,
  type GenerateInput,
  type ListModelsInput,
  type ProviderAdapter
} from './types'

interface OpenAiReply {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

interface OpenAiModels {
  data?: Array<{ id?: unknown }>
}

function authHeaders(key: string): Record<string, string> {
  return key.length > 0 ? { authorization: `Bearer ${key}` } : {}
}

function replyText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }
        if (
          part &&
          typeof part === 'object' &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text
        }
        return ''
      })
      .join('')
  }
  return ''
}

export class OpenAiCompatProvider implements ProviderAdapter {
  readonly id: AiProvider = 'openai-compat'

  async generate(input: GenerateInput): Promise<string> {
    if (!input.model) {
      throw new ProviderError('bad_request', 'Choose a model first.')
    }

    const data = (await fetchProviderJson(
      joinUrl(input.baseUrl, 'chat/completions'),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeaders(input.key)
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0.4,
          max_tokens: 8192,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user }
          ]
        }),
        signal: input.signal
      },
      'generate'
    )) as OpenAiReply

    const text = replyText(data.choices?.[0]?.message?.content)
    if (text.trim().length === 0) {
      throw blockedReply()
    }
    return text
  }

  async listModels(input: ListModelsInput): Promise<string[]> {
    const data = (await fetchProviderJson(
      joinUrl(input.baseUrl, 'models'),
      {
        method: 'GET',
        headers: authHeaders(input.key),
        signal: input.signal
      },
      'list'
    )) as OpenAiModels

    const models: string[] = []
    for (const model of data.data ?? []) {
      if (typeof model.id === 'string' && model.id.length > 0 && !models.includes(model.id)) {
        models.push(model.id)
      }
    }
    return models
  }
}
