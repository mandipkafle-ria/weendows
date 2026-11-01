import { useEffect, useMemo, useState, type JSX } from 'react'
import { resolveWidgetAppearance } from '../../shared/appearance'
import { findBuiltinVariant } from '../../shared/builtins'
import type {
  BuiltinWidget,
  CursorStyle,
  WidgetContent,
  WidgetContentField,
  WidgetSummary
} from '../../shared/types'
import { t } from '../i18n'
import type { ToastLevel } from './useToasts'
import WidgetPreview from './WidgetPreview'

interface WidgetContentSheetProps {
  builtin: BuiltinWidget
  existing: WidgetSummary
  dark: boolean
  cursorStyle: CursorStyle
  onClose: () => void
  onSaved: () => Promise<void>
  toast: (message: string, level?: ToastLevel) => void
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [delay, value])
  return debounced
}

type RowDraft = Record<string, string | number>
type Draft = Record<string, unknown>

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function seedRow(fields: WidgetContentField[], raw: Record<string, unknown>): RowDraft {
  const row: RowDraft = {}
  for (const field of fields) {
    row[field.key] =
      field.type === 'number' ? asNumber(raw[field.key], field.min ?? 0) : asString(raw[field.key])
  }
  return row
}

function seedDraft(
  fields: WidgetContentField[],
  content: WidgetContent,
  defaults: WidgetContent
): Draft {
  const draft: Draft = {}
  for (const field of fields) {
    const raw = field.key in content ? content[field.key] : defaults[field.key]
    if (field.type === 'list') {
      const rows = Array.isArray(raw) ? raw.filter(isRecord) : []
      draft[field.key] = rows.map((row) => seedRow(field.itemFields ?? [], row))
      continue
    }
    draft[field.key] = field.type === 'number' ? asNumber(raw, field.min ?? 0) : asString(raw)
  }
  return draft
}

function buildContent(fields: WidgetContentField[], draft: Draft): WidgetContent {
  const content: WidgetContent = {}
  for (const field of fields) {
    const value = draft[field.key]
    if (field.type === 'list') {
      const rows = Array.isArray(value) ? (value as RowDraft[]) : []
      const itemFields = field.itemFields ?? []
      const items = rows
        .map((row) => {
          const item: Record<string, unknown> = {}
          for (const itemField of itemFields) {
            const cell = row[itemField.key]
            if (itemField.type === 'number') {
              item[itemField.key] = asNumber(cell, itemField.min ?? 0)
            } else {
              const text = typeof cell === 'string' ? cell.trim() : ''
              if (text) {
                item[itemField.key] = text
              }
            }
          }
          return item
        })
        .filter((item) => Object.keys(item).length > 0)
      content[field.key] = items
      continue
    }
    if (field.type === 'number') {
      content[field.key] = asNumber(value, field.min ?? 0)
      continue
    }
    const text = typeof value === 'string' ? value.trim() : ''
    if (text) {
      content[field.key] = text
    }
  }
  return content
}

function fieldLabel(field: WidgetContentField): string {
  const value = t(field.labelKey)
  return value === field.labelKey ? field.key : value
}

export default function WidgetContentSheet({
  builtin,
  existing,
  dark,
  cursorStyle,
  onClose,
  onSaved,
  toast
}: WidgetContentSheetProps): JSX.Element {
  const fields = useMemo(() => builtin.contentSchema?.fields ?? [], [builtin])
  const defaults = useMemo<WidgetContent>(() => builtin.contentDefaults ?? {}, [builtin])
  const original = useMemo<WidgetContent>(
    () => (isRecord(existing.placement.content) ? existing.placement.content : {}),
    [existing]
  )
  const [draft, setDraft] = useState<Draft>(() => seedDraft(fields, original, defaults))
  const [pending, setPending] = useState(false)
  const previewDraft = useDebouncedValue(draft, 350)
  const previewContent = useMemo(() => buildContent(fields, previewDraft), [fields, previewDraft])
  const variant = findBuiltinVariant(builtin, existing.manifest.variant).id
  const appearance = useMemo(
    () => resolveWidgetAppearance(existing.placement),
    [existing.placement]
  )

  const setValue = (key: string, value: unknown): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const setRow = (key: string, index: number, cellKey: string, value: string | number): void => {
    setDraft((current) => {
      const rows = Array.isArray(current[key]) ? [...(current[key] as RowDraft[])] : []
      const row = { ...(rows[index] ?? {}) }
      row[cellKey] = value
      rows[index] = row
      return { ...current, [key]: rows }
    })
  }

  const addRow = (field: WidgetContentField): void => {
    const itemFields = field.itemFields ?? []
    const row: RowDraft = {}
    for (const itemField of itemFields) {
      row[itemField.key] = itemField.type === 'number' ? (itemField.min ?? 0) : ''
    }
    setDraft((current) => ({
      ...current,
      [field.key]: [
        ...(Array.isArray(current[field.key]) ? (current[field.key] as RowDraft[]) : []),
        row
      ]
    }))
  }

  const removeRow = (field: WidgetContentField, index: number): void => {
    setDraft((current) => {
      const rows = Array.isArray(current[field.key]) ? (current[field.key] as RowDraft[]) : []
      return { ...current, [field.key]: rows.filter((_, i) => i !== index) }
    })
  }

  const moveRow = (field: WidgetContentField, index: number, delta: -1 | 1): void => {
    setDraft((current) => {
      const rows = Array.isArray(current[field.key]) ? [...(current[field.key] as RowDraft[])] : []
      const target = index + delta
      if (target < 0 || target >= rows.length) {
        return current
      }
      const [row] = rows.splice(index, 1)
      if (row) {
        rows.splice(target, 0, row)
      }
      return { ...current, [field.key]: rows }
    })
  }

  const save = async (content: WidgetContent): Promise<void> => {
    setPending(true)
    try {
      await window.api.setWidgetContent(existing.placement.widgetId, content)
      await onSaved()
      toast(t('content.saved', { name: existing.manifest.name }), 'success')
      onClose()
    } catch (error) {
      toast(errorMessage(error), 'error')
    } finally {
      setPending(false)
    }
  }

  const reset = async (): Promise<void> => {
    setDraft(seedDraft(fields, {}, defaults))
    await save({})
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="customize-sheet content-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('content.title', { name: existing.manifest.name })}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="customize-head">
          <div>
            <span className="customize-eyebrow">{t('content.eyebrow')}</span>
            <h2>{t('content.title', { name: existing.manifest.name })}</h2>
          </div>
          <button
            type="button"
            className="sheet-close"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            &#10005;
          </button>
        </header>

        <div className="customize-body content-body">
          <div className="content-preview">
            <WidgetPreview
              source={{ kind: 'builtin', type: builtin.type, variant }}
              width={existing.placement.width}
              height={existing.placement.height}
              dark={dark}
              cursorStyle={cursorStyle}
              appearance={appearance}
              assetWidgetId={existing.placement.widgetId}
              title={existing.manifest.name}
              content={previewContent}
              className="content-preview-frame"
            />
            <span className="content-preview-note">{t('content.previewNote')}</span>
          </div>
          <p className="content-intro">{t('content.intro')}</p>
          {fields.map((field) => {
            const value = draft[field.key]
            if (field.type === 'list') {
              const rows = Array.isArray(value) ? (value as RowDraft[]) : []
              const itemFields = field.itemFields ?? []
              return (
                <section className="customize-section content-list" key={field.key}>
                  <div className="content-list-head">
                    <h3>{fieldLabel(field)}</h3>
                    <button
                      type="button"
                      className="button-quiet button-compact"
                      onClick={() => addRow(field)}
                      disabled={pending}
                    >
                      {t('content.add')}
                    </button>
                  </div>
                  {rows.length === 0 && <p className="content-empty">{t('content.emptyList')}</p>}
                  {rows.map((row, index) => (
                    <div className="content-row" key={`${field.key}-${index}`}>
                      <div className="content-row-fields">
                        {itemFields.map((itemField) => (
                          <label className="content-field" key={itemField.key}>
                            <span>{fieldLabel(itemField)}</span>
                            {itemField.type === 'number' ? (
                              <input
                                type="number"
                                min={itemField.min}
                                max={itemField.max}
                                step={itemField.step ?? 1}
                                value={asNumber(row[itemField.key], itemField.min ?? 0)}
                                onChange={(event) =>
                                  setRow(
                                    field.key,
                                    index,
                                    itemField.key,
                                    Number(event.target.value)
                                  )
                                }
                                disabled={pending}
                              />
                            ) : (
                              <input
                                type="text"
                                value={asString(row[itemField.key])}
                                onChange={(event) =>
                                  setRow(field.key, index, itemField.key, event.target.value)
                                }
                                disabled={pending}
                              />
                            )}
                          </label>
                        ))}
                      </div>
                      <div className="content-row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={t('content.moveUp')}
                          onClick={() => moveRow(field, index, -1)}
                          disabled={pending || index === 0}
                        >
                          &#8593;
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={t('content.moveDown')}
                          onClick={() => moveRow(field, index, 1)}
                          disabled={pending || index === rows.length - 1}
                        >
                          &#8595;
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button-danger"
                          aria-label={t('content.remove')}
                          onClick={() => removeRow(field, index)}
                          disabled={pending}
                        >
                          &#10005;
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              )
            }

            return (
              <section className="customize-section" key={field.key}>
                <label className="content-field">
                  <span>{fieldLabel(field)}</span>
                  {field.type === 'number' ? (
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step ?? 1}
                      value={asNumber(value, field.min ?? 0)}
                      onChange={(event) => setValue(field.key, Number(event.target.value))}
                      disabled={pending}
                    />
                  ) : field.multiline ? (
                    <textarea
                      rows={3}
                      value={asString(value)}
                      placeholder={
                        typeof defaults[field.key] === 'string'
                          ? (defaults[field.key] as string)
                          : ''
                      }
                      onChange={(event) => setValue(field.key, event.target.value)}
                      disabled={pending}
                    />
                  ) : (
                    <input
                      type="text"
                      value={asString(value)}
                      placeholder={
                        typeof defaults[field.key] === 'string'
                          ? (defaults[field.key] as string)
                          : ''
                      }
                      onChange={(event) => setValue(field.key, event.target.value)}
                      disabled={pending}
                    />
                  )}
                </label>
              </section>
            )
          })}
        </div>

        <footer className="customize-foot">
          <button
            type="button"
            className="button-quiet"
            onClick={() => void reset()}
            disabled={pending}
          >
            {t('content.reset')}
          </button>
          <div className="content-foot-actions">
            <button type="button" className="button-quiet" onClick={onClose} disabled={pending}>
              {t('content.cancel')}
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={() => void save(buildContent(fields, draft))}
              disabled={pending}
            >
              {t('content.save')}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
