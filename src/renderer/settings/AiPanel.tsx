import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type {
  AiConfig,
  AiGenerateResult,
  AiProvider,
  AiWidgetSource,
  WidgetLogEntry,
  WidgetPermission
} from '../../shared/types'
import { t } from '../i18n'

interface AiPanelProps {
  editWidgetId: string | null
  onChanged: () => void
}

const PRESETS: Array<{ id: string; label: string; provider: AiProvider; baseUrl: string }> = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
  },
  {
    id: 'groq',
    label: 'Groq',
    provider: 'openai-compat',
    baseUrl: 'https://api.groq.com/openai/v1'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    provider: 'openai-compat',
    baseUrl: 'https://openrouter.ai/api/v1'
  },
  {
    id: 'mistral',
    label: 'Mistral',
    provider: 'openai-compat',
    baseUrl: 'https://api.mistral.ai/v1'
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    provider: 'openai-compat',
    baseUrl: 'http://localhost:11434/v1'
  }
]

const STARTERS = [
  'ai.starters.battery',
  'ai.starters.pomodoro',
  'ai.starters.countdown',
  'ai.starters.calendar',
  'ai.starters.habit',
  'ai.starters.quote',
  'ai.starters.weather'
]

const POLICIES: Record<string, string> = {
  'generativelanguage.googleapis.com': 'https://ai.google.dev/gemini-api/terms',
  'api.groq.com': 'https://groq.com/privacy-policy/',
  'openrouter.ai': 'https://openrouter.ai/privacy',
  'api.mistral.ai': 'https://mistral.ai/terms',
  'localhost:11434': 'https://ollama.com/legal/privacy'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function presetFor(provider: AiProvider, baseUrl: string): string {
  return (
    PRESETS.find((preset) => preset.provider === provider && preset.baseUrl === baseUrl)?.id ??
    'custom'
  )
}

function policyFor(baseUrl: string): string | null {
  try {
    return POLICIES[new URL(baseUrl).host] ?? null
  } catch {
    return null
  }
}

function AppAiPanel({ editWidgetId, onChanged }: AiPanelProps): JSX.Element {
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [provider, setProvider] = useState<AiProvider>('gemini')
  const [preset, setPreset] = useState('gemini')
  const [baseUrl, setBaseUrl] = useState(PRESETS[0]!.baseUrl)
  const [model, setModel] = useState('')
  const [width, setWidth] = useState(240)
  const [height, setHeight] = useState(240)
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const operationRef = useRef(0)
  const modelRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [instruction, setInstruction] = useState('')
  const [result, setResult] = useState<AiGenerateResult | null>(null)
  const [previewLogs, setPreviewLogs] = useState<WidgetLogEntry[]>([])
  const [previewActive, setPreviewActive] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [approvedPermissions, setApprovedPermissions] = useState<WidgetPermission[]>([])
  const [approvedHosts, setApprovedHosts] = useState<string[]>([])
  const [source, setSource] = useState<AiWidgetSource | null>(null)
  const [sourceLoading, setSourceLoading] = useState(Boolean(editWidgetId))

  useEffect(() => {
    let cancelled = false
    void window.api
      .getAiConfig()
      .then((next) => {
        if (cancelled) {
          return
        }
        setConfig(next)
        setProvider(next.provider)
        setBaseUrl(next.baseUrl)
        setPreset(presetFor(next.provider, next.baseUrl))
        setModel(next.model)
        setWidth(next.width)
        setHeight(next.height)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(messageOf(loadError))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!editWidgetId) {
      return
    }
    let cancelled = false
    void window.api
      .getAiWidgetSource(editWidgetId)
      .then((next) => {
        if (!cancelled) {
          setSource(next)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(messageOf(loadError))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSourceLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [editWidgetId])

  useEffect(() => {
    if (!previewActive) {
      return
    }
    let cancelled = false
    const timer = setInterval(() => {
      void window.api
        .getAiPreviewLogs()
        .then((logs) => {
          if (!cancelled) {
            setPreviewLogs(logs)
          }
        })
        .catch(() => undefined)
    }, 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [previewActive])

  const policyUrl = useMemo(() => policyFor(baseUrl), [baseUrl])

  const applyConfig = (next: AiConfig): void => {
    setConfig(next)
    setProvider(next.provider)
    setBaseUrl(next.baseUrl)
    setPreset(presetFor(next.provider, next.baseUrl))
    setModel(next.model)
    setWidth(next.width)
    setHeight(next.height)
  }

  const persistSettings = async (): Promise<AiConfig> => {
    const next = await window.api.saveAiSettings({
      provider,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      width,
      height
    })
    applyConfig(next)
    return next
  }

  const run = async (label: string, action: () => Promise<void>): Promise<void> => {
    setBusy(label)
    setError(null)
    setStatus(null)
    try {
      await action()
    } catch (actionError) {
      setError(messageOf(actionError))
    } finally {
      setBusy(null)
    }
  }

  const handleProvider = (nextProvider: AiProvider): void => {
    const nextPreset = PRESETS.find((item) => item.provider === nextProvider)
    setProvider(nextProvider)
    if (nextPreset) {
      setPreset(nextPreset.id)
      setBaseUrl(nextPreset.baseUrl)
    }
  }

  const handlePreset = (id: string): void => {
    setPreset(id)
    const found = PRESETS.find((item) => item.id === id)
    if (found) {
      setProvider(found.provider)
      setBaseUrl(found.baseUrl)
    }
  }

  const saveKey = async (): Promise<void> => {
    await run('key', async () => {
      applyConfig(await window.api.saveAiKey(provider, apiKey))
      setApiKey('')
      setStatus(t('ai.keySavedStatus'))
    })
  }

  const removeKey = async (): Promise<void> => {
    await run('remove-key', async () => {
      await persistSettings()
      applyConfig(await window.api.removeAiKey())
      setStatus(t('ai.keyRemoved'))
    })
  }

  const loadModels = async (): Promise<void> => {
    await run('models', async () => {
      await persistSettings()
      const list = await window.api.listAiModels()
      setModels(list)
      if (!model.trim() && list.length === 1) {
        setModel(list[0]!)
      }
      setStatus(
        list.length === 0
          ? t('ai.noModels')
          : t(list.length === 1 ? 'ai.loadedModelsOne' : 'ai.loadedModels', {
              count: list.length
            })
      )
    })
  }

  const testConnection = async (): Promise<void> => {
    await run('test', async () => {
      await persistSettings()
      const tested = await window.api.testAiConnection()
      if (!tested.ok) {
        throw new Error(tested.message)
      }
      setStatus(t('ai.connected', { count: tested.modelCount }))
    })
  }

  const showResult = (next: AiGenerateResult): void => {
    setResult(next)
    setPreviewLogs(next.logs)
    setPreviewActive(next.ok || next.logs.length > 0)
    if (next.ok) {
      setApprovedPermissions(next.manifest.permissions)
      setApprovedHosts(next.manifest.allowedHosts)
      setApprovalOpen(true)
    }
  }

  const ensureModel = (): boolean => {
    if (model.trim().length > 0) {
      return true
    }
    setError(t('ai.chooseModelFirst'))
    modelRef.current?.focus()
    return false
  }

  const generate = async (): Promise<void> => {
    if (!ensureModel()) {
      return
    }
    const operation = ++operationRef.current
    await run('generate', async () => {
      await persistSettings()
      if (operationRef.current !== operation) {
        return
      }
      setResult(null)
      setPreviewActive(false)
      setApprovalOpen(false)
      const next = await window.api.generateAiWidget(prompt)
      if (operationRef.current === operation) {
        showResult(next)
      }
    })
  }

  const revise = async (): Promise<void> => {
    if (!editWidgetId || !ensureModel()) {
      return
    }
    const operation = ++operationRef.current
    await run('revise', async () => {
      await persistSettings()
      if (operationRef.current !== operation) {
        return
      }
      setResult(null)
      setPreviewActive(false)
      setApprovalOpen(false)
      const next = await window.api.reviseAiWidget(editWidgetId, instruction)
      if (operationRef.current === operation) {
        showResult(next)
      }
    })
  }

  const repair = async (): Promise<void> => {
    const operation = ++operationRef.current
    await run('repair', async () => {
      const next = await window.api.repairAiWidget()
      if (operationRef.current === operation) {
        showResult(next)
      }
    })
  }

  const closePreview = async (): Promise<void> => {
    await run('close', async () => {
      await window.api.closeAiPreview()
      setResult(null)
      setPreviewLogs([])
      setPreviewActive(false)
      setApprovalOpen(false)
      setStatus(t('ai.previewClosed'))
    })
  }

  const cancel = async (): Promise<void> => {
    operationRef.current += 1
    await run('cancel', async () => {
      await window.api.cancelAi()
      setResult(null)
      setPreviewLogs([])
      setPreviewActive(false)
      setApprovalOpen(false)
      setStatus(t('ai.cancelled'))
    })
  }

  const saveWidget = async (): Promise<void> => {
    await run('save', async () => {
      const saved = await window.api.approveAndSaveAiWidget({
        permissions: approvedPermissions,
        allowedHosts: approvedHosts
      })
      setApprovalOpen(false)
      setResult(null)
      setPreviewLogs([])
      setPreviewActive(false)
      setStatus(t('ai.widgetSaved', { name: saved.summary.manifest.name }))
      onChanged()
      if (editWidgetId) {
        setSource(await window.api.getAiWidgetSource(editWidgetId))
      }
    })
  }

  const undo = async (): Promise<void> => {
    if (!editWidgetId) {
      return
    }
    await run('undo', async () => {
      const restored = await window.api.undoAiWidget(editWidgetId)
      setStatus(t('ai.undoDone', { name: restored.summary.manifest.name }))
      onChanged()
      setSource(await window.api.getAiWidgetSource(editWidgetId))
    })
  }

  const togglePermission = (permission: WidgetPermission, checked: boolean): void => {
    setApprovedPermissions((current) =>
      checked ? [...current, permission] : current.filter((item) => item !== permission)
    )
  }

  const toggleHost = (host: string, checked: boolean): void => {
    setApprovedHosts((current) =>
      checked ? [...current, host] : current.filter((item) => item !== host)
    )
  }

  const needsKey = !(provider === 'openai-compat' && preset === 'ollama')
  const busyMessage =
    busy === 'generate'
      ? t('ai.busyGenerate')
      : busy === 'revise'
        ? t('ai.busyRevise')
        : busy === 'repair'
          ? t('ai.busyRepair')
          : busy === 'models'
            ? t('ai.busyModels')
            : busy === 'test'
              ? t('ai.busyTest')
              : busy === 'key'
                ? t('ai.busyKey')
                : busy === 'remove-key'
                  ? t('ai.busyRemoveKey')
                  : busy === 'save'
                    ? t('ai.busySave')
                    : busy === 'undo'
                      ? t('ai.busyUndo')
                      : busy === 'close'
                        ? t('ai.busyClose')
                        : busy === 'cancel'
                          ? t('ai.busyCancel')
                          : busy === 'settings'
                            ? t('ai.busySettings')
                            : null
  const activity = busy ? busyMessage : (error ?? status)
  const activityIsError = !busy && error !== null

  return (
    <section className="ai-panel">
      {activity && (
        <div
          className={activityIsError ? 'ai-activity ai-activity-error' : 'ai-activity'}
          role={activityIsError ? 'alert' : 'status'}
          aria-live="polite"
          aria-busy={busy !== null}
        >
          {busy !== null && <span className="ai-spinner" aria-hidden="true" />}
          <span>{activity}</span>
        </div>
      )}
      <section className="panel panel-wide">
        <div className="section-head">
          <div className="panel-copy">
            <h2>{t('ai.providerTitle')}</h2>
            <p>{t('ai.providerBody')}</p>
          </div>
          <span className={`section-count ${config?.hasKey ? 'status-ok' : 'status-idle'}`}>
            {config?.hasKey ? t('ai.keySaved') : needsKey ? t('ai.noKey') : t('ai.noKeyNeeded')}
          </span>
        </div>
        <div className="ai-form">
          <label>
            {t('ai.provider')}
            <select
              value={provider}
              onChange={(event) => handleProvider(event.target.value as AiProvider)}
            >
              <option value="gemini">{t('ai.providerGemini')}</option>
              <option value="openai-compat">{t('ai.providerOpenAi')}</option>
            </select>
          </label>
          {provider === 'openai-compat' && (
            <label>
              {t('ai.preset')}
              <select value={preset} onChange={(event) => handlePreset(event.target.value)}>
                {PRESETS.filter((item) => item.provider === 'openai-compat').map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
                <option value="custom">{t('ai.custom')}</option>
              </select>
            </label>
          )}
          <label className="ai-field-wide">
            {t('ai.baseUrl')}
            <input
              value={baseUrl}
              onChange={(event) => {
                setBaseUrl(event.target.value)
                setPreset('custom')
              }}
              spellCheck={false}
            />
          </label>
          <label>
            {t('ai.apiKey')}
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={config?.hasKey ? t('ai.savedKeyPlaceholder') : t('ai.apiKeyPlaceholder')}
              spellCheck={false}
            />
          </label>
          <label className="ai-field-wide">
            {t('ai.model')}
            <input
              ref={modelRef}
              value={model}
              onChange={(event) => {
                setModel(event.target.value)
                setError(null)
              }}
              list="ai-models"
              placeholder={t('ai.modelPlaceholder')}
              spellCheck={false}
            />
            <datalist id="ai-models">
              {models.map((item) => (
                <option value={item} key={item} />
              ))}
            </datalist>
            {models.length > 0 && (
              <select
                aria-label={t('ai.loadedModelsLabel')}
                value={models.includes(model) ? model : ''}
                onChange={(event) => {
                  setModel(event.target.value)
                  setError(null)
                }}
              >
                <option value="">{t('ai.chooseLoadedModel')}</option>
                {models.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
            <span className={`ai-field-hint ${model.trim() ? '' : 'ai-field-warning'}`}>
              {models.length > 0
                ? t(models.length === 1 ? 'ai.modelsLoadedHintOne' : 'ai.modelsLoadedHint', {
                    count: models.length
                  })
                : t('ai.modelsHint')}
            </span>
          </label>
          <label>
            {t('ai.width')}
            <input
              type="number"
              min={120}
              max={800}
              value={width}
              onChange={(event) => setWidth(Number(event.target.value))}
            />
          </label>
          <label>
            {t('ai.height')}
            <input
              type="number"
              min={120}
              max={800}
              value={height}
              onChange={(event) => setHeight(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="ai-actions">
          <button
            type="button"
            onClick={() =>
              void run('settings', async () => {
                await persistSettings()
                setStatus(t('ai.providerSaved'))
              })
            }
            disabled={busy !== null}
          >
            {t('ai.saveSettings')}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void saveKey()}
            disabled={busy !== null || apiKey.trim().length === 0}
          >
            {t('ai.saveKey')}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void removeKey()}
            disabled={busy !== null || !config?.hasKey}
          >
            {t('ai.removeKey')}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void loadModels()}
            disabled={busy !== null}
          >
            {busy === 'models' ? t('ai.loading') : t('ai.loadModels')}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void testConnection()}
            disabled={busy !== null}
          >
            {busy === 'test' ? t('ai.testing') : t('ai.testConnection')}
          </button>
        </div>
      </section>

      {editWidgetId ? (
        <section className="panel panel-wide">
          <div className="section-head">
            <div className="panel-copy">
              <h2>{t('ai.editTitle')}</h2>
              <p>
                {sourceLoading
                  ? t('ai.loadingCurrent')
                  : source
                    ? t(source.historyCount === 1 ? 'ai.sourceMeta' : 'ai.sourceMetaPlural', {
                        name: source.manifest.name,
                        width: source.manifest.width,
                        height: source.manifest.height,
                        count: source.historyCount
                      })
                    : t('ai.sourceFailed')}
              </p>
            </div>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void undo()}
              disabled={busy !== null || !source || source.historyCount === 0}
            >
              {busy === 'undo' ? t('ai.restoring') : t('ai.undoLast')}
            </button>
          </div>
          <label className="ai-prompt">
            {t('ai.changeLabel')}
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={t('ai.changePlaceholder')}
            />
          </label>
          <div className="ai-actions">
            <button
              type="button"
              onClick={() => void revise()}
              disabled={busy !== null || instruction.trim().length === 0}
            >
              {busy === 'revise' ? t('ai.revising') : t('ai.revise')}
            </button>
          </div>
        </section>
      ) : (
        <section className="panel panel-wide">
          <div className="section-head">
            <div className="panel-copy">
              <h2>{t('ai.describeTitle')}</h2>
              <p>{t('ai.describeBody')}</p>
            </div>
          </div>
          <label className="ai-prompt">
            {t('ai.prompt')}
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              maxLength={4000}
              placeholder={t('ai.promptPlaceholder')}
            />
          </label>
          <div className="starter-chips">
            {STARTERS.map((starter) => (
              <button
                type="button"
                className="chip"
                key={starter}
                onClick={() => setPrompt(t(starter))}
                disabled={busy !== null}
              >
                {t(starter)}
              </button>
            ))}
          </div>
          <div className="ai-actions">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={busy !== null || prompt.trim().length === 0}
            >
              {busy === 'generate' ? t('ai.generating') : t('ai.generate')}
            </button>
            {(busy === 'generate' || busy === 'revise' || busy === 'repair') && (
              <button type="button" className="button-secondary" onClick={() => void cancel()}>
                {t('ai.cancel')}
              </button>
            )}
          </div>
          <p className="ai-privacy">
            {t('ai.privacy')}{' '}
            {policyUrl ? (
              <button
                type="button"
                className="link-button"
                onClick={() => void window.api.openExternal(policyUrl)}
              >
                {t('ai.dataPolicy')}
              </button>
            ) : (
              t('ai.checkPolicy')
            )}
          </p>
          <p className="ai-privacy">{t('ai.freeTier')}</p>
        </section>
      )}

      {result && (
        <section className="panel panel-wide ai-result">
          <div className="section-head">
            <div className="panel-copy">
              <h2>{result.ok ? t('ai.previewReady') : t('ai.needsAttention')}</h2>
              <p>
                {result.ok
                  ? t(result.repairs === 1 ? 'ai.previewMetaOne' : 'ai.previewMeta', {
                      name: result.manifest.name,
                      width: result.manifest.width,
                      height: result.manifest.height,
                      repairs: result.repairs
                    })
                  : result.message}
              </p>
            </div>
            <div className="ai-actions">
              {result.ok ? (
                <>
                  <button
                    type="button"
                    onClick={() => setApprovalOpen(true)}
                    disabled={busy !== null}
                  >
                    {t('ai.reviewPermissions')}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void closePreview()}
                    disabled={busy !== null}
                  >
                    {t('ai.closePreview')}
                  </button>
                </>
              ) : (
                <>
                  {result.canRepair && (
                    <button type="button" onClick={() => void repair()} disabled={busy !== null}>
                      {busy === 'repair' ? t('ai.repairing') : t('ai.fixAgain')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void closePreview()}
                    disabled={busy !== null}
                  >
                    {t('ai.closePreview')}
                  </button>
                </>
              )}
            </div>
          </div>

          {!result.ok && result.problems.length > 0 && (
            <ul className="ai-problems">
              {result.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          {result.warnings.length > 0 && (
            <ul className="ai-warnings">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <details className="ai-console" open={previewLogs.length > 0}>
            <summary>{t('ai.console', { count: previewLogs.length })}</summary>
            {previewLogs.length === 0 ? (
              <p>{t('ai.noLogs')}</p>
            ) : (
              <ol>
                {previewLogs.map((entry, index) => (
                  <li className={`log-${entry.level}`} key={`${entry.at}-${index}`}>
                    <span>{entry.level}</span> {entry.message}
                  </li>
                ))}
              </ol>
            )}
          </details>
        </section>
      )}

      {approvalOpen && result?.ok && (
        <div className="ai-modal-backdrop">
          <div
            className="ai-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('ai.approveLabel')}
          >
            <h2>{t('ai.saveTitle', { name: result.manifest.name })}</h2>
            <p>{t('ai.saveBody')}</p>
            {result.manifest.permissions.length === 0 ? (
              <p className="empty">{t('ai.noPermissions')}</p>
            ) : (
              <div className="ai-approval-list">
                {result.manifest.permissions.map((permission) => (
                  <label className="permission-toggle" key={permission}>
                    <input
                      type="checkbox"
                      checked={approvedPermissions.includes(permission)}
                      onChange={(event) => togglePermission(permission, event.target.checked)}
                    />
                    <span>{t(`permissions.${permission}`)}</span>
                  </label>
                ))}
              </div>
            )}
            {result.manifest.allowedHosts.length > 0 && (
              <div className="ai-approval-list">
                <strong>{t('ai.allowedHosts')}</strong>
                {result.manifest.allowedHosts.map((host) => (
                  <label className="permission-toggle" key={host}>
                    <input
                      type="checkbox"
                      checked={approvedHosts.includes(host)}
                      onChange={(event) => toggleHost(host, event.target.checked)}
                    />
                    <span>{host}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="ai-modal-actions">
              <button type="button" onClick={() => void saveWidget()} disabled={busy !== null}>
                {busy === 'save' ? t('ai.savingWidget') : t('ai.saveWidget')}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setApprovalOpen(false)}
                disabled={busy !== null}
              >
                {t('ai.back')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default AppAiPanel
