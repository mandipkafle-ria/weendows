import type { JSX } from 'react'
import { findBuiltinVariant } from '../../shared/builtins'
import type { BuiltinWidget, GeneralState, WidgetCategory, WidgetSummary } from '../../shared/types'
import { WIDGET_CATEGORIES } from '../../shared/types'
import { t } from '../i18n'
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

interface WidgetCatalogProps {
  builtins: BuiltinWidget[]
  widgets: WidgetSummary[]
  general: GeneralState
  pending: string | null
  onAdd: (builtin: BuiltinWidget, variant: string) => void
  onCustomize: (builtin: BuiltinWidget, variant: string) => void
  onSeeAll: (category: WidgetCategory) => void
}

export default function WidgetCatalog({
  builtins,
  widgets,
  general,
  pending,
  onAdd,
  onCustomize,
  onSeeAll
}: WidgetCatalogProps): JSX.Element {
  const categories = WIDGET_CATEGORIES.filter((category) =>
    builtins.some((builtin) => builtin.category === category)
  )

  if (builtins.length === 0) {
    return (
      <div className="empty-state">
        <strong>{t('widgets.noMatchesTitle')}</strong>
        <span>{t('widgets.noMatchesBody')}</span>
      </div>
    )
  }

  return (
    <div className="catalog-sections">
      {categories.map((category) => {
        const entries = builtins.filter((builtin) => builtin.category === category)
        return (
          <section className="catalog-section" key={category}>
            <header className="catalog-section-head">
              <div>
                <span className="category-mark" data-category={category} aria-hidden="true" />
                <h2>{t(`widgets.categories.${category}`)}</h2>
                <span className="catalog-count">{entries.length}</span>
              </div>
              <button type="button" className="button-quiet" onClick={() => onSeeAll(category)}>
                {t('widgets.seeAll', { count: entries.length })}
              </button>
            </header>
            <div className="catalog-row">
              {entries.slice(0, 4).map((builtin) => {
                const variant = findBuiltinVariant(builtin, builtin.variants[0]?.id)
                const count = widgets.filter(
                  (widget) => widget.manifest.builtinType === builtin.type
                ).length
                const busy = pending === `add:${builtin.type}`
                return (
                  <article className="catalog-card" key={builtin.type}>
                    <button
                      type="button"
                      className="catalog-preview"
                      aria-label={t('widgets.customize.open', {
                        name: catalogName(builtin.type, builtin.name)
                      })}
                      onClick={() => onCustomize(builtin, variant.id)}
                    >
                      <WidgetPreview
                        source={{ kind: 'builtin', type: builtin.type, variant: variant.id }}
                        width={variant.width}
                        height={variant.height}
                        dark={general.resolvedWidgetTheme === 'dark'}
                        cursorStyle={general.cursor.style}
                        title={catalogName(builtin.type, builtin.name)}
                      />
                      {count > 0 && (
                        <span className="preview-count">
                          {t('widgets.onDesktopCount', { count })}
                        </span>
                      )}
                    </button>
                    <div className="catalog-card-body">
                      <div>
                        <h3>
                          {variantName(variant.id)} {catalogName(builtin.type, builtin.name)}
                        </h3>
                        <span className="meta-line">
                          {t('widgets.dimensions', {
                            width: variant.width,
                            height: variant.height
                          })}{' '}
                          &middot; {t(`widgets.categories.${builtin.category}`)}
                        </span>
                      </div>
                      <p>{catalogBody(builtin.type, builtin.description)}</p>
                      <div className="catalog-card-actions">
                        <button
                          type="button"
                          className="button-quiet"
                          onClick={() => onCustomize(builtin, variant.id)}
                        >
                          {t('widgets.customize.action')}
                        </button>
                        <button
                          type="button"
                          className="button-primary"
                          disabled={pending !== null || general.safeMode}
                          title={general.safeMode ? t('widgets.safeMode') : undefined}
                          onClick={() => onAdd(builtin, variant.id)}
                        >
                          {busy ? t('common.adding') : t('common.add')}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
