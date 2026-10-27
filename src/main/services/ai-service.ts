import { safeStorage } from 'electron'
import { AI_MAX_REPAIRS, AI_PREVIEW_LOG_WAIT_MS, AI_TIMEOUT_MS } from '../../shared/constants'
import { minimumSizeFor } from '../../shared/widget-size'
import type {
  AiApproval,
  AiConfig,
  AiGenerateResult,
  AiManifest,
  AiSaveResult,
  AiSettings,
  AiTestResult,
  AiWidgetSource,
  WidgetLogEntry
} from '../../shared/types'
import { setEditMode } from './edit-mode'
import { checkWidgetHtml, parseWidgetReply, ParseError } from './ai-parse'
import { buildRepairMessage, buildReviseMessage, generatorSystemPrompt } from './ai-prompts'
import type { AiConfigService } from './ai-config'
import type { SecretsService } from './secrets'
import type { WidgetApiService } from './widget-api'
import type { WidgetService } from './widget-service'
import type { LayoutService } from '../windows/layout'
import { GeminiProvider } from './providers/gemini'
import { OpenAiCompatProvider } from './providers/openai-compat'
import {
  isAbortError,
  ProviderError,
  validateProviderBaseUrl,
  type ProviderAdapter
} from './providers/types'

export interface AiServiceOptions {
  config: AiConfigService
  secrets: SecretsService
  widgetService: WidgetService
  widgetApi: WidgetApiService
  layout: LayoutService
}

interface ActiveRequest {
  controller: AbortController
  timer: NodeJS.Timeout
  timedOut: boolean
  cancelled: boolean
}

interface CurrentWidget {
  manifest: AiManifest
  html: string
  prompt: string
  mode: 'create' | 'revise'
  targetWidgetId: string | null
}

interface LastAttempt {
  raw: string
  problems: string[]
  logs: WidgetLogEntry[]
  warnings: string[]
  system: string
  prompt: string
  mode: 'create' | 'revise'
  targetWidgetId: string | null
  repairs: number
}

type Validation =
  | { ok: true; manifest: AiManifest; html: string; warnings: string[] }
  | { ok: false; problems: string[]; warnings: string[] }

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isLocalBase(raw: string): boolean {
  try {
    const url = new URL(raw)
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' ||
      url.hostname === '::1'
    )
  } catch {
    return false
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function aiManifestFrom(manifest: {
  name: string
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  permissions: AiManifest['permissions']
  allowedHosts: string[]
}): AiManifest {
  return {
    name: manifest.name,
    width: manifest.width,
    height: manifest.height,
    ...minimumSizeFor(manifest.width, manifest.height, manifest),
    permissions: [...manifest.permissions],
    allowedHosts: [...manifest.allowedHosts]
  }
}

export class AiService {
  private readonly config: AiConfigService
  private readonly secrets: SecretsService
  private readonly widgetService: WidgetService
  private readonly widgetApi: WidgetApiService
  private readonly layout: LayoutService
  private readonly gemini = new GeminiProvider()
  private readonly openai = new OpenAiCompatProvider()
  private request: ActiveRequest | null = null
  private previewId: string | null = null
  private current: CurrentWidget | null = null
  private lastAttempt: LastAttempt | null = null

  constructor(options: AiServiceOptions) {
    this.config = options.config
    this.secrets = options.secrets
    this.widgetService = options.widgetService
    this.widgetApi = options.widgetApi
    this.layout = options.layout
  }

  getConfig(): AiConfig {
    const settings = this.config.get()
    return { ...settings, hasKey: this.secrets.hasKey(settings.provider) }
  }

  async saveSettings(settings: AiSettings): Promise<AiConfig> {
    const baseUrl = validateProviderBaseUrl(settings.provider, settings.baseUrl)
    await this.config.save({ ...settings, baseUrl })
    return this.getConfig()
  }

  async saveKey(provider: AiSettings['provider'], key: string): Promise<AiConfig> {
    await this.secrets.saveKey(provider, key)
    return this.getConfig()
  }

  async removeKey(): Promise<AiConfig> {
    await this.secrets.removeKey(this.config.get().provider)
    return this.getConfig()
  }

  async listModels(): Promise<string[]> {
    const request = this.beginRequest()
    try {
      return await this.listModelsWith(request)
    } finally {
      this.endRequest(request)
    }
  }

  async testConnection(): Promise<AiTestResult> {
    const request = this.beginRequest()
    try {
      const models = await this.listModelsWith(request)
      return { ok: true, modelCount: models.length }
    } catch (error) {
      return { ok: false, message: this.messageFor(error, request) }
    } finally {
      this.endRequest(request)
    }
  }

  async generateWidget(prompt: string): Promise<AiGenerateResult> {
    await this.cancel()
    this.current = null
    this.lastAttempt = null

    const settings = this.config.get()
    const system = generatorSystemPrompt(settings.width, settings.height)
    return this.run(system, prompt.trim(), 'create', null, prompt.trim())
  }

  async reviseWidget(widgetId: string, instruction: string): Promise<AiGenerateResult> {
    let source: Awaited<ReturnType<WidgetService['readWidgetSource']>>
    try {
      source = await this.widgetService.readWidgetSource(widgetId)
    } catch (error) {
      return this.failure(asMessage(error), [], [], [], 0, false)
    }

    await this.cancel()
    this.current = null
    this.lastAttempt = null

    const manifest = aiManifestFrom(source.manifest)
    const system = generatorSystemPrompt(manifest.width, manifest.height)
    return this.run(
      system,
      buildReviseMessage(manifest, source.html, instruction.trim()),
      'revise',
      widgetId,
      source.manifest.prompt ?? instruction.trim()
    )
  }

  async repair(): Promise<AiGenerateResult> {
    const previous = this.lastAttempt
    if (!previous) {
      return this.failure('There is nothing to repair.', [], [], [], 0, false)
    }

    const request = this.beginRequest()
    const repairs = previous.repairs + 1
    try {
      const raw = await this.requestText(
        previous.system,
        buildRepairMessage(previous.raw, previous.problems, previous.logs),
        request
      )
      return await this.finishAttempt(raw, previous, repairs)
    } catch (error) {
      return this.failure(
        this.messageFor(error, request),
        previous.problems,
        previous.logs,
        previous.warnings,
        repairs,
        true
      )
    } finally {
      this.endRequest(request)
    }
  }

  async cancel(): Promise<void> {
    if (this.request) {
      this.request.cancelled = true
      this.request.controller.abort()
    }
    await this.closePreview()
    this.lastAttempt = null
  }

  async getPreviewLogs(): Promise<WidgetLogEntry[]> {
    if (!this.previewId) {
      return []
    }
    return this.widgetApi.getLogs(this.previewId)
  }

  async closePreview(): Promise<void> {
    const previewId = this.previewId
    this.previewId = null
    this.current = null
    if (!previewId) {
      return
    }
    this.layout.closePreview(previewId)
    await this.widgetService.removePreview(previewId)
    this.widgetApi.forgetLogs(previewId)
  }

  async savePreview(approval: AiApproval): Promise<AiSaveResult> {
    const current = this.current
    if (!current) {
      throw new Error('There is no validated widget to save.')
    }

    const approved: AiApproval = {
      permissions: current.manifest.permissions.filter((permission) =>
        approval.permissions.includes(permission)
      ),
      allowedHosts: current.manifest.allowedHosts.filter((host) =>
        approval.allowedHosts.includes(host)
      )
    }

    if (current.mode === 'revise' && current.targetWidgetId) {
      const widgetId = current.targetWidgetId
      await this.widgetService.updateWidgetFromAi(
        widgetId,
        current.manifest,
        current.html,
        approved
      )
      await this.closePreview()
      this.layout.reloadWidget(widgetId)
      setEditMode(true)
      this.layout.notifyChanged()
      const summary = this.widgetService.getSummary(widgetId)
      if (!summary) {
        throw new Error('The widget was saved but could not be found.')
      }
      return { widgetId, summary }
    }

    const placement = this.layout.nextPlacementForSize(
      current.manifest.width,
      current.manifest.height
    )
    const summary = await this.widgetService.createAiWidget(
      current.manifest,
      current.html,
      placement,
      current.prompt,
      approved
    )
    await this.closePreview()
    await this.layout.openWidgetById(summary.manifest.id)
    setEditMode(true)
    this.layout.notifyChanged()
    return { widgetId: summary.manifest.id, summary }
  }

  async getWidgetSource(widgetId: string): Promise<AiWidgetSource> {
    const source = await this.widgetService.readWidgetSource(widgetId)
    return {
      widgetId,
      manifest: source.manifest,
      historyCount: await this.widgetService.historyCount(widgetId)
    }
  }

  async undoWidget(widgetId: string): Promise<AiSaveResult> {
    const manifest = await this.widgetService.undoWidget(widgetId)
    this.layout.reloadWidget(widgetId)
    setEditMode(true)
    this.layout.notifyChanged()
    const summary = this.widgetService.getSummary(widgetId)
    if (!summary) {
      throw new Error('The widget was restored but could not be found.')
    }
    return { widgetId: manifest.id, summary }
  }

  private async run(
    system: string,
    user: string,
    mode: 'create' | 'revise',
    targetWidgetId: string | null,
    prompt: string
  ): Promise<AiGenerateResult> {
    const request = this.beginRequest()
    let repairs = 0
    let raw: string
    let lastProblems: string[] = []
    let lastWarnings: string[] = []
    let lastLogs: WidgetLogEntry[] = []

    try {
      raw = await this.requestText(system, user, request)

      while (true) {
        const checked = this.validateReply(raw)
        if (checked.ok) {
          await this.closePreview()
          const preview = await this.preview(checked.manifest, checked.html, prompt)
          lastLogs = preview.logs
          lastWarnings = checked.warnings
          const errors = preview.logs.filter((entry) => entry.level === 'error')
          if (errors.length === 0) {
            this.current = {
              manifest: checked.manifest,
              html: checked.html,
              prompt,
              mode,
              targetWidgetId
            }
            this.lastAttempt = null
            return this.success(checked.manifest, lastLogs, checked.warnings, repairs)
          }

          lastProblems = errors.map((entry) => `The preview logged an error: ${entry.message}`)
          if (repairs >= AI_MAX_REPAIRS) {
            this.current = null
            this.lastAttempt = {
              raw,
              problems: lastProblems,
              logs: lastLogs,
              warnings: lastWarnings,
              system,
              prompt,
              mode,
              targetWidgetId,
              repairs
            }
            return this.failure(
              'The preview reported errors after two repair attempts.',
              lastProblems,
              lastLogs,
              lastWarnings,
              repairs,
              true
            )
          }
          await this.closePreview()
          raw = await this.requestText(
            system,
            buildRepairMessage(raw, lastProblems, lastLogs),
            request
          )
          repairs += 1
          continue
        }

        lastProblems = checked.problems
        lastWarnings = checked.warnings
        if (repairs >= AI_MAX_REPAIRS) {
          this.current = null
          this.lastAttempt = {
            raw,
            problems: lastProblems,
            logs: lastLogs,
            warnings: lastWarnings,
            system,
            prompt,
            mode,
            targetWidgetId,
            repairs
          }
          return this.failure(
            'The widget did not pass validation after two repair attempts.',
            lastProblems,
            lastLogs,
            lastWarnings,
            repairs,
            true
          )
        }
        await this.closePreview()
        raw = await this.requestText(
          system,
          buildRepairMessage(raw, lastProblems, lastLogs),
          request
        )
        repairs += 1
      }
    } catch (error) {
      this.current = null
      return this.failure(
        this.messageFor(error, request),
        lastProblems,
        lastLogs,
        lastWarnings,
        repairs,
        lastProblems.length > 0
      )
    } finally {
      this.endRequest(request)
    }
  }

  private async finishAttempt(
    raw: string,
    previous: LastAttempt,
    repairs: number
  ): Promise<AiGenerateResult> {
    const checked = this.validateReply(raw)
    if (!checked.ok) {
      this.current = null
      this.lastAttempt = {
        raw,
        problems: checked.problems,
        logs: previous.logs,
        warnings: checked.warnings,
        system: previous.system,
        prompt: previous.prompt,
        mode: previous.mode,
        targetWidgetId: previous.targetWidgetId,
        repairs
      }
      return this.failure(
        'The repaired widget still did not pass validation.',
        checked.problems,
        previous.logs,
        checked.warnings,
        repairs,
        true
      )
    }

    await this.closePreview()
    const preview = await this.preview(checked.manifest, checked.html, previous.prompt)
    const errors = preview.logs.filter((entry) => entry.level === 'error')
    if (errors.length > 0) {
      const problems = errors.map((entry) => `The preview logged an error: ${entry.message}`)
      this.current = null
      this.lastAttempt = {
        raw,
        problems,
        logs: preview.logs,
        warnings: checked.warnings,
        system: previous.system,
        prompt: previous.prompt,
        mode: previous.mode,
        targetWidgetId: previous.targetWidgetId,
        repairs
      }
      return this.failure(
        'The repaired widget reported an error in preview.',
        problems,
        preview.logs,
        checked.warnings,
        repairs,
        true
      )
    }

    this.current = {
      manifest: checked.manifest,
      html: checked.html,
      prompt: previous.prompt,
      mode: previous.mode,
      targetWidgetId: previous.targetWidgetId
    }
    this.lastAttempt = null
    return this.success(checked.manifest, preview.logs, checked.warnings, repairs)
  }

  private async preview(
    manifest: AiManifest,
    html: string,
    prompt: string
  ): Promise<{ logs: WidgetLogEntry[] }> {
    const preview = await this.widgetService.createPreview(manifest, html, prompt)
    this.previewId = preview.id
    try {
      await this.layout.openPreview(preview)
    } catch (error) {
      this.previewId = null
      await this.widgetService.removePreview(preview.id)
      throw new Error(`The preview could not open: ${asMessage(error)}`, { cause: error })
    }
    await delay(AI_PREVIEW_LOG_WAIT_MS)
    return { logs: this.widgetApi.getLogs(preview.id) }
  }

  private validateReply(raw: string): Validation {
    let manifest: AiManifest
    let html: string
    try {
      const parsed = parseWidgetReply(raw)
      manifest = parsed.manifest
      html = parsed.html
    } catch (error) {
      if (error instanceof ParseError) {
        return { ok: false, problems: error.problems, warnings: [] }
      }
      throw error
    }

    const checked = checkWidgetHtml(html, manifest)
    if (checked.problems.length > 0) {
      return { ok: false, problems: checked.problems, warnings: checked.warnings }
    }
    return { ok: true, manifest, html, warnings: checked.warnings }
  }

  private async requestText(system: string, user: string, request: ActiveRequest): Promise<string> {
    const settings = this.config.get()
    const baseUrl = validateProviderBaseUrl(settings.provider, settings.baseUrl)
    const key = this.keyFor(settings)
    const adapter = this.adapter(settings.provider)
    return adapter.generate({
      baseUrl,
      model: settings.model,
      key,
      system,
      user,
      signal: request.controller.signal
    })
  }

  private async listModelsWith(request: ActiveRequest): Promise<string[]> {
    const settings = this.config.get()
    const baseUrl = validateProviderBaseUrl(settings.provider, settings.baseUrl)
    const key = this.keyFor(settings)
    return this.adapter(settings.provider).listModels({
      baseUrl,
      key,
      signal: request.controller.signal
    })
  }

  private decryptKey(provider: AiSettings['provider']): string | null {
    const encrypted = this.secrets.getEncryptedKey(provider)
    if (!encrypted) {
      return null
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is unavailable on this system. Save the API key again.')
    }
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    } catch {
      throw new Error('The stored API key could not be decrypted. Save it again.')
    }
  }

  private keyFor(settings: AiSettings): string {
    const key = this.decryptKey(settings.provider)
    if (key) {
      return key
    }
    if (settings.provider === 'openai-compat' && isLocalBase(settings.baseUrl)) {
      return ''
    }
    throw new Error('Add an API key in Settings.')
  }

  private adapter(provider: AiSettings['provider']): ProviderAdapter {
    return provider === 'gemini' ? this.gemini : this.openai
  }

  private beginRequest(): ActiveRequest {
    if (this.request) {
      this.request.cancelled = true
      this.request.controller.abort()
      clearTimeout(this.request.timer)
    }

    const controller = new AbortController()
    const request: ActiveRequest = {
      controller,
      timer: setTimeout(() => {
        request.timedOut = true
        controller.abort()
      }, AI_TIMEOUT_MS),
      timedOut: false,
      cancelled: false
    }
    this.request = request
    return request
  }

  private endRequest(request: ActiveRequest): void {
    clearTimeout(request.timer)
    if (this.request === request) {
      this.request = null
    }
  }

  private messageFor(error: unknown, request: ActiveRequest): string {
    if (request.cancelled) {
      return 'Cancelled.'
    }
    if (request.timedOut || isAbortError(error)) {
      return 'The model took too long. Try a shorter request or a faster model.'
    }
    if (error instanceof ProviderError) {
      return error.message
    }
    return asMessage(error)
  }

  private success(
    manifest: AiManifest,
    logs: WidgetLogEntry[],
    warnings: string[],
    repairs: number
  ): AiGenerateResult {
    if (!this.previewId) {
      return this.failure('The preview could not open.', [], logs, warnings, repairs, false)
    }
    return {
      ok: true,
      previewId: this.previewId,
      manifest,
      logs,
      warnings,
      repairs
    }
  }

  private failure(
    message: string,
    problems: string[],
    logs: WidgetLogEntry[],
    warnings: string[],
    repairs: number,
    canRepair: boolean
  ): AiGenerateResult {
    return {
      ok: false,
      message,
      problems,
      logs,
      warnings,
      repairs,
      canRepair
    }
  }
}
