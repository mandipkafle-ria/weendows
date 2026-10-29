import { useMemo, useState, type JSX } from 'react'
import type { BuiltinWidget, GeneralState, WidgetCategory, WidgetSummary } from '../../shared/types'
import { t } from '../i18n'
import type { ThemeEnvId } from './themeEnvironments'
import WidgetPreview from './WidgetPreview'

function catalogName(type: string, fallback: string): string {
  const key = `widgets.catalog.${type}.name`
  const value = t(key)
  return value === key ? fallback : value
}

function catalogBody(type: string, fallback: string): string {
  const key = `widgets.catalog.${type}.body`
  const value = t(key)
  return value === key ? fallback : value
}

function variantName(variantId: string): string {
  const key = `widgets.variantNames.${variantId}`
  const value = t(key)
  return value === key ? variantId : value
}

interface CategoryEntry {
  builtin: BuiltinWidget
  variantId: string
  width: number
  height: number
}

interface WidgetCategoryPageProps {
  category: WidgetCategory
  builtins: BuiltinWidget[]
  widgets: WidgetSummary[]
  general: GeneralState
  themeEnv: ThemeEnvId
  themeMode?: 'dark' | 'light'
  pending: string | null
  onBack: () => void
  onAdd: (builtin: BuiltinWidget, variant: string) => void
  onCustomize: (builtin: BuiltinWidget, variant: string) => void
  onOpenAiStudio: () => void
}

export default function WidgetCategoryPage({
  category,
  builtins,
  widgets,
  general,
  themeEnv,
  themeMode,
  pending,
  onBack,
  onAdd,
  onCustomize,
  onOpenAiStudio
}: WidgetCategoryPageProps): JSX.Element {
  const [tag, setTag] = useState('all')
  const [query, setQuery] = useState('')

  const entries = useMemo<CategoryEntry[]>(
    () =>
      builtins
        .filter((builtin) => builtin.category === category)
        .flatMap((builtin) =>
          builtin.variants.map((variant) => ({
            builtin,
            variantId: variant.id,
            width: variant.width,
            height: variant.height
          }))
        ),
    [builtins, category]
  )

  const tags = useMemo(() => {
    const values = new Set<string>()
    for (const entry of entries) {
      for (const value of entry.builtin.variants.find((v) => v.id === entry.variantId)?.tags ??
        []) {
        values.add(value)
      }
    }
    return [...values].sort()
  }, [entries])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (tag !== 'all') {
        const tagsForVariant =
          entry.builtin.variants.find((variant) => variant.id === entry.variantId)?.tags ?? []
        if (!tagsForVariant.includes(tag)) {
          return false
        }
      }
      if (!needle) {
        return true
      }
      return (
        catalogName(entry.builtin.type, entry.builtin.name).toLowerCase().includes(needle) ||
        variantName(entry.variantId).toLowerCase().includes(needle) ||
        catalogBody(entry.builtin.type, entry.builtin.description).toLowerCase().includes(needle)
      )
    })
  }, [entries, query, tag])

  return (
    <section className="category-page">
      <header className="category-head">
        <button type="button" className="button-quiet category-back" onClick={onBack}>
          &larr; {t('widgets.backToWidgets')}
        </button>
        <div className="category-title-row">
          <div>
            <h2>{t(`widgets.categories.${category}`)}</h2>
            <span className="meta-line">
              {t('widgets.categoryCount', { count: entries.length })}
            </span>
          </div>
          <label className="search-field">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('widgets.searchPlaceholder')}
              spellCheck={false}
            />
          </label>
        </div>
        <div className="filter-chips" role="group" aria-label={t('widgets.styleFilters')}>
          <button
            type="button"
            className={tag === 'all' ? 'filter-chip chip-active' : 'filter-chip'}
            onClick={() => setTag('all')}
          >
            {t('widgets.categoryAll')}
          </button>
          {tags.map((value) => (
            <button
              type="button"
              key={value}
              className={tag === value ? 'filter-chip chip-active' : 'filter-chip'}
              onClick={() => setTag(value)}
            >
              {t(`widgets.tags.${value}`)}
            </button>
          ))}
        </div>
      </header>

      <div className="category-grid">
        {filtered.map((entry) => {
          const count = widgets.filter(
            (widget) => widget.manifest.builtinType === entry.builtin.type
          ).length
          const busy = pending === `add:${entry.builtin.type}`
          return (
            <article className="category-card" key={`${entry.builtin.type}:${entry.variantId}`}>
              <button
                type="button"
                className="category-preview"
                aria-label={t('widgets.customize.open', {
                  name: `${variantName(entry.variantId)} ${catalogName(
                    entry.builtin.type,
                    entry.builtin.name
                  )}`
                })}
                onClick={() => onCustomize(entry.builtin, entry.variantId)}
              >
                <WidgetPreview
                  source={{
                    kind: 'builtin',
                    type: entry.builtin.type,
                    variant: entry.variantId
                  }}
                  width={entry.width}
                  height={entry.height}
                  dark={themeMode ? themeMode === 'dark' : themeEnv !== 'sky'}
                  env={themeEnv}
                  cursorStyle={general.cursor.style}
                  title={`${variantName(entry.variantId)} ${catalogName(
                    entry.builtin.type,
                    entry.builtin.name
                  )}`}
                />
                {count > 0 && (
                  <span className="preview-count">{t('widgets.onDesktopCount', { count })}</span>
                )}
              </button>
              <div className="category-card-body">
                <div>
                  <h3>{variantName(entry.variantId)}</h3>
                  <span className="meta-line">
                    {catalogName(entry.builtin.type, entry.builtin.name)} &middot; {entry.width}{' '}
                    &times; {entry.height}
                  </span>
                </div>
                <div className="category-card-actions">
                  <button
                    type="button"
                    className="button-quiet"
                    onClick={() => onCustomize(entry.builtin, entry.variantId)}
                  >
                    {t('widgets.customize.action')}
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    disabled={pending !== null || general.safeMode}
                    title={general.safeMode ? t('widgets.safeMode') : undefined}
                    onClick={() => onAdd(entry.builtin, entry.variantId)}
                  >
                    {busy ? t('common.adding') : t('common.add')}
                  </button>
                </div>
              </div>
            </article>
          )
        })}

        {filtered.length === 0 && (
          <div className="empty-state">
            <strong>{t('widgets.noMatchesTitle')}</strong>
            <span>{t('widgets.noMatchesBody')}</span>
          </div>
        )}

        <article className="category-card category-ai-card">
          <button type="button" className="category-ai" onClick={onOpenAiStudio}>
            <span className="category-ai-plus" aria-hidden="true">
              +
            </span>
            <strong>{t('widgets.createWithAi')}</strong>
            <span>{t('widgets.createWithAiBody')}</span>
          </button>
        </article>
      </div>
    </section>
  )
}
