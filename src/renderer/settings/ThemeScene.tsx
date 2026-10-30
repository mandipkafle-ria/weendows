import { useEffect, useMemo, useRef, type CSSProperties, type JSX } from 'react'
import { findBuiltinVariant } from '../../shared/builtins'
import type { BuiltinWidget, GeneralState, WidgetCategory, WidgetVariant } from '../../shared/types'
import { t } from '../i18n'
import type { ThemeEnvId } from './themeEnvironments'
import ExpandableSearch from './ExpandableSearch'
import WidgetPreview from './WidgetPreview'

const PARTICLE_COUNT: Record<ThemeEnvId, number> = {
  sky: 0,
  forest: 9,
  glass: 6,
  midnight: 20,
  sakura: 12,
  mono: 0,
  ember: 9
}

interface ThemeSceneProps {
  themeEnv: ThemeEnvId
  themeMode?: 'dark' | 'light'
  builtins: BuiltinWidget[]
  general: GeneralState
  query: string
  categoryFilter: WidgetCategory | 'all'
  onQueryChange: (query: string) => void
  onCategoryFilterChange: (category: WidgetCategory | 'all') => void
  onCustomize: (builtin: BuiltinWidget, variant: string) => void
  onSwitchToCatalog: () => void
}

interface ScenePiece {
  builtin: BuiltinWidget
  variant: WidgetVariant
}

function catalogName(type: string, fallback: string): string {
  const key = `widgets.catalog.${type}.name`
  const value = t(key)
  return value === key ? fallback : value
}

function variantName(variantId: string): string {
  const key = `widgets.variantNames.${variantId}`
  const value = t(key)
  return value === key ? variantId : value
}

export default function ThemeScene({
  themeEnv,
  themeMode,
  builtins,
  general,
  query,
  categoryFilter,
  onQueryChange,
  onCategoryFilterChange,
  onCustomize,
  onSwitchToCatalog
}: ThemeSceneProps): JSX.Element {
  const canvasRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sceneDark = themeMode ? themeMode === 'dark' : themeEnv !== 'sky'

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [themeEnv])

  const pieces = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches: ScenePiece[] = []

    for (const builtin of builtins) {
      if (categoryFilter !== 'all' && builtin.category !== categoryFilter) {
        continue
      }
      if (needle) {
        const haystack = [
          catalogName(builtin.type, builtin.name),
          builtin.description,
          builtin.type,
          ...builtin.variants.flatMap((v) => [variantName(v.id), ...(v.tags ?? [])])
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(needle)) {
          continue
        }
      }
      // Show only the default (first) variant per widget type
      const variant = findBuiltinVariant(builtin, builtin.variants[0]?.id)
      matches.push({ builtin, variant })
    }

    return matches
  }, [builtins, categoryFilter, query])

  const gridPieces = useMemo(
    () =>
      pieces.map((piece) => ({
        ...piece,
        key: `${piece.builtin.type}:${piece.variant.id}`
      })),
    [pieces]
  )

  const particles = useMemo(() => {
    const count = PARTICLE_COUNT[themeEnv]
    const scattered = themeEnv === 'midnight' || themeEnv === 'glass'
    return Array.from({ length: count }, (_, index) => {
      const style: CSSProperties = {
        left: `${(index * 37 + 11) % 100}%`,
        animationDelay: `${(index % 8) * 0.55}s`,
        animationDuration: scattered ? `${3 + (index % 5)}s` : `${7 + (index % 6)}s`
      }
      if (scattered) {
        style.top = `${(index * 53 + 7) % 94}%`
      }
      return style
    })
  }, [themeEnv])

  const categories: Array<{ id: WidgetCategory | 'all'; label: string }> = [
    { id: 'all', label: t('widgets.categoryAll') },
    { id: 'time', label: t('widgets.categories.time') },
    { id: 'system', label: t('widgets.categories.system') },
    { id: 'ambient', label: t('widgets.categories.ambient') },
    { id: 'focus', label: t('widgets.categories.focus') },
    { id: 'apps', label: t('widgets.categories.apps') }
  ]

  return (
    <div
      className="theme-scene"
      data-theme-env={themeEnv}
      data-theme-mode={themeMode ?? (sceneDark ? 'dark' : 'light')}
    >
      <div
        className="scene-atmosphere"
        key={`${themeEnv}-${sceneDark ? 'dark' : 'light'}`}
        aria-hidden="true"
      >
        <div className="scene-cloud scene-cloud-1" />
        <div className="scene-cloud scene-cloud-2" />
        <div className="scene-cloud scene-cloud-3" />
        <div className="scene-cloud scene-cloud-4" />
        <div className={`scene-particles particles-${themeEnv}`}>
          {particles.map((style, index) => (
            <span key={index} style={style} />
          ))}
        </div>
        <div className="scene-grain" />
      </div>

      <div className="scene-scroll" ref={scrollRef}>
        <div className="scene-canvas scene-canvas-masonry" ref={canvasRef}>
          {gridPieces.map((piece) => (
            <button
              type="button"
              key={piece.key}
              className="scene-piece"
              aria-label={`${t('widgets.customize.open', {
                name: catalogName(piece.builtin.type, piece.builtin.name)
              })} · ${variantName(piece.variant.id)}`}
              onClick={() => onCustomize(piece.builtin, piece.variant.id)}
            >
              <WidgetPreview
                source={{
                  kind: 'builtin',
                  type: piece.builtin.type,
                  variant: piece.variant.id
                }}
                width={piece.variant.width}
                height={piece.variant.height}
                dark={sceneDark}
                env={themeEnv}
                cursorStyle={general.cursor.style}
                title={catalogName(piece.builtin.type, piece.builtin.name)}
              />
            </button>
          ))}

          {pieces.length === 0 && (
            <div className="scene-empty">
              <strong>{t('widgets.noMatchesTitle')}</strong>
              <span>{t('widgets.noMatchesBody')}</span>
            </div>
          )}
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {t('widgets.categoryCount', { count: pieces.length })}
      </span>

      <div className="scene-filter-bar">
        <div className="scene-filter-chips" role="group" aria-label={t('widgets.categoriesLabel')}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              aria-pressed={categoryFilter === cat.id}
              className={
                categoryFilter === cat.id ? 'filter-chip filter-chip-active' : 'filter-chip'
              }
              onClick={() => onCategoryFilterChange(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <ExpandableSearch
          className="scene-filter-search"
          value={query}
          onChange={onQueryChange}
          label={t('widgets.searchLabel')}
          placeholder={t('widgets.searchPlaceholder')}
          clearLabel={t('widgets.clearSearch')}
        />

        <button type="button" className="scene-catalog-btn" onClick={onSwitchToCatalog}>
          {t('widgets.galleryTitle')}
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </div>
  )
}
