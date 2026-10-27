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

interface GeminiReply {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> }
  }>
  promptFeedback?: { blockReason?: unknown }
}

interface GeminiModels {
  models?: Array<{
    name?: unknown
    supportedGenerationMethods?: unknown
  }>
}

function modelId(raw: string): string {
  return raw.replace(/^models\//, '')
}

export class GeminiProvider implements ProviderAdapter {
  readonly id: AiProvider = 'gemini'

  async generate(input: GenerateInput): Promise<string> {
    if (!input.model) {
      throw new ProviderError('bad_request', 'Choose a model first.')
    }

    const data = (await fetchProviderJson(
      joinUrl(input.baseUrl, `models/${encodeURIComponent(modelId(input.model))}:generateContent`),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': input.key
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: 'user', parts: [{ text: input.user }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
        }),
        signal: input.signal
      },
      'generate'
    )) as GeminiReply

    if (data.promptFeedback?.blockReason) {
      throw blockedReply()
    }

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')

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
        headers: { 'x-goog-api-key': input.key },
        signal: input.signal
      },
      'list'
    )) as GeminiModels

    const models: string[] = []
    for (const model of data.models ?? []) {
      if (typeof model.name !== 'string') {
        continue
      }
      const methods = model.supportedGenerationMethods
      if (Array.isArray(methods) && !methods.includes('generateContent')) {
        continue
      }
      const id = modelId(model.name)
      if (id.length > 0 && !models.includes(id)) {
        models.push(id)
      }
    }
    return models
  }
}
