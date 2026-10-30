import { useEffect, useState, type JSX } from 'react'
import {
  WALLPAPER_FITS,
  WALLPAPER_INTERVAL_MINUTES,
  type WallpaperFit,
  type WallpaperItem,
  type WallpaperLiveOptions,
  type WallpaperState
} from '../../shared/types'
import { isLiveWallpaperFit, isWallpaperFit, WALLPAPER_LIVE_FITS } from '../../shared/wallpaper-fit'
import { t } from '../i18n'

const FIT_KEYS: Record<WallpaperFit, string> = {
  fill: 'wallpaper.fitFill',
  fit: 'wallpaper.fitFit',
  stretch: 'wallpaper.fitStretch',
  tile: 'wallpaper.fitTile',
  center: 'wallpaper.fitCenter',
  span: 'wallpaper.fitSpan'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function intervalLabel(minutes: number): string {
  return minutes === 1440 ? t('wallpaper.daily') : t('wallpaper.minutes', { count: minutes })
}

function typeLabel(item: WallpaperItem): string {
  if (item.type === 'image') {
    return t('wallpaper.typeImage')
  }
  return item.type === 'video' ? t('wallpaper.typeVideo') : t('wallpaper.typeHtml')
}

interface WallpaperCardProps {
  item: WallpaperItem
  selected: WallpaperItem | null
  currentId: string | null
  imageErrors: Record<string, boolean>
  onSelect: (item: WallpaperItem) => void
  onImageError: (id: string) => void
}

function WallpaperCard({
  item,
  selected,
  currentId,
  imageErrors,
  onSelect,
  onImageError,
}: WallpaperCardProps): JSX.Element {
  const selectedCard = item.id === selected?.id
  const current = item.id === currentId
  return (
    <button
      type="button"
      className={selectedCard ? 'wallpaper-card wallpaper-selected' : 'wallpaper-card'}
      onClick={() => onSelect(item)}
    >
      <span className="wallpaper-thumb">
        {item.type === 'html' || imageErrors[item.id] ? (
          <span className="wallpaper-generic">
            {item.type === 'html'
              ? t('wallpaper.typeHtml')
              : t('wallpaper.previewUnavailable')}
          </span>
        ) : (
          <img
            src={`hl-wallpaper://thumb/${item.id}`}
            alt=""
            onError={() => onImageError(item.id)}
          />
        )}
        <span className="wallpaper-type">{typeLabel(item)}</span>
        {current && <span className="wallpaper-current">{t('wallpaper.current')}</span>}
      </span>
      <span className="wallpaper-name" title={item.name}>
        {item.name}
      </span>
    </button>
  )
}

function WallpaperPanel(): JSX.Element {
  const [state, setState] = useState<WallpaperState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fits, setFits] = useState<Record<string, WallpaperFit>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    void window.api
      .getWallpaperState()
      .then((next) => {
        if (!cancelled) {
          setState(next)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(messageOf(loadError))
        }
      })

    const off = window.api.onWallpaperChanged((next) => {
      if (!cancelled) {
        setState(next)
      }
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const selected =
    state?.items.find((item) => item.id === selectedId) ??
    state?.items.find((item) => item.id === state.config.currentId) ??
    state?.items[0] ??
    null
  const selectedFit =
    selected && selected.type !== 'image' && !isLiveWallpaperFit(selected.fit)
      ? 'fill'
      : selected?.fit
  const fit = selected ? (fits[selected.id] ?? selectedFit ?? 'fill') : 'fill'
  const fitOptions = selected && selected.type !== 'image' ? WALLPAPER_LIVE_FITS : WALLPAPER_FITS
  const images = state?.items.filter((item) => item.type === 'image') ?? []
  const slideshowEnabled = state?.config.mode === 'slideshow'
  const busyNow = busy !== null
  const liveOptions: WallpaperLiveOptions = {
    pauseOnBattery: state?.config.pauseOnBattery ?? true,
    videoMuted: state?.config.videoMuted ?? true
  }

  const run = async (
    key: string,
    action: () => Promise<WallpaperState>,
    success: string | null
  ): Promise<void> => {
    setBusy(key)
    setError(null)
    setStatus(null)
    try {
      const next = await action()
      setState(next)
      if (success) {
        setStatus(success)
      }
    } catch (actionError) {
      setError(messageOf(actionError))
    } finally {
      setBusy(null)
    }
  }

  const addFiles = async (): Promise<void> => {
    const before = state?.items.length ?? 0
    setBusy('add-files')
    setError(null)
    setStatus(null)
    try {
      const next = await window.api.addWallpapers()
      setState(next)
      const added = next.items.length - before
      if (added > 0) {
        setStatus(t(added === 1 ? 'wallpaper.added' : 'wallpaper.addedPlural', { count: added }))
      }
    } catch (actionError) {
      setError(messageOf(actionError))
    } finally {
      setBusy(null)
    }
  }

  const addFolder = async (): Promise<void> => {
    const before = state?.items.length ?? 0
    setBusy('add-folder')
    setError(null)
    setStatus(null)
    try {
      const next = await window.api.addWallpaperFolder()
      setState(next)
      if (next.items.length > before) {
        setStatus(t('wallpaper.folderAdded'))
      }
    } catch (actionError) {
      setError(messageOf(actionError))
    } finally {
      setBusy(null)
    }
  }

  const removeSelected = async (): Promise<void> => {
    if (!selected) {
      return
    }
    if (!window.confirm(t('wallpaper.removeConfirm', { name: selected.name }))) {
      return
    }
    await run('remove', () => window.api.removeWallpaper(selected.id), t('wallpaper.removed'))
  }

  const setSelectedWallpaper = async (): Promise<void> => {
    if (!selected) {
      return
    }
    if (selected.type === 'image') {
      await run(
        'set',
        () => window.api.setStaticWallpaper(selected.id, fit),
        t('wallpaper.applied')
      )
      return
    }
    await run(
      'set',
      () => window.api.setLiveWallpaper(selected.id, fit),
      t('wallpaper.liveStarted')
    )
  }

  const updateLiveOptions = async (patch: Partial<WallpaperLiveOptions>): Promise<void> => {
    await run(
      'live-options',
      () => window.api.setWallpaperLiveOptions({ ...liveOptions, ...patch }),
      null
    )
  }

  const updateInteractive = async (interactive: boolean): Promise<void> => {
    if (!selected || selected.type !== 'html') {
      return
    }
    await run(
      'interactive',
      () => window.api.setWallpaperInteractive(selected.id, interactive),
      null
    )
  }

  const updateSlideshow = async (
    enabled: boolean,
    intervalMinutes: number,
    shuffle: boolean
  ): Promise<void> => {
    await run(
      'slideshow',
      () => window.api.setWallpaperSlideshow({ enabled, intervalMinutes, shuffle }),
      enabled ? t('wallpaper.slideshowStarted') : t('wallpaper.slideshowStopped')
    )
  }

  const selectItem = (item: WallpaperItem): void => {
    setSelectedId(item.id)
  }

  return (
    <section className="panel panel-wide wallpaper-panel">
      <div className="section-head">
        <div className="panel-copy">
          <h2>{t('wallpaper.libraryTitle')}</h2>
          <p>{t('wallpaper.libraryBody')}</p>
        </div>
        <span className="section-count">
          {t('wallpaper.savedCount', { count: state?.items.length ?? 0 })}
        </span>
      </div>

      <div className="wallpaper-actions">
        <button type="button" onClick={() => void addFiles()} disabled={busyNow}>
          {busy === 'add-files' ? t('wallpaper.adding') : t('wallpaper.addMedia')}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => void addFolder()}
          disabled={busyNow}
        >
          {busy === 'add-folder' ? t('wallpaper.adding') : t('wallpaper.addFolder')}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() =>
            void run(
              'restore',
              () => window.api.restoreOriginalWallpaper(),
              t('wallpaper.restored')
            )
          }
          disabled={busyNow || !state?.config.originalWallpaperPath}
        >
          {busy === 'restore' ? t('wallpaper.restoring') : t('wallpaper.restore')}
        </button>
      </div>

      {(error || status) && (
        <p className={error ? 'action-message action-error' : 'action-message'} role="status">
          {error ?? status}
        </p>
      )}

      {!state ? (
        <p className="empty">{t('wallpaper.loading')}</p>
      ) : state.items.length === 0 ? (
        <p className="empty">{t('wallpaper.empty')}</p>
      ) : (
        <>
          {state.items.some((item) => item.builtin && item.type === 'html') && (
            <div className="wallpaper-section">
              <h3 className="wallpaper-section-title">✦ Live Wallpapers</h3>
              <div className="wallpaper-grid">
                {state.items
                  .filter((item) => item.builtin && item.type === 'html')
                  .map((item) => (
                    <WallpaperCard
                      key={item.id}
                      item={item}
                      selected={selected}
                      currentId={state.config.currentId}
                      imageErrors={imageErrors}
                      onSelect={selectItem}
                      onImageError={(id) =>
                        setImageErrors((e) => ({ ...e, [id]: true }))
                      }
                    />
                  ))}
              </div>
            </div>
          )}
          {state.items.some((item) => !item.builtin) && (
            <div className="wallpaper-section">
              <h3 className="wallpaper-section-title">Your Library</h3>
              <div className="wallpaper-grid">
                {state.items
                  .filter((item) => !item.builtin)
                  .map((item) => (
                    <WallpaperCard
                      key={item.id}
                      item={item}
                      selected={selected}
                      currentId={state.config.currentId}
                      imageErrors={imageErrors}
                      onSelect={selectItem}
                      onImageError={(id) =>
                        setImageErrors((e) => ({ ...e, [id]: true }))
                      }
                    />
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="wallpaper-controls">
        <div className="wallpaper-control-group">
          <label className="wallpaper-field">
            <span>{t('wallpaper.fit')}</span>
            <select
              value={fit}
              disabled={busyNow || !selected}
              onChange={(event) => {
                const value = event.target.value
                if (selected && isWallpaperFit(value)) {
                  setFits((current) => ({ ...current, [selected.id]: value }))
                }
              }}
            >
              {fitOptions.map((value) => (
                <option value={value} key={value}>
                  {t(FIT_KEYS[value])}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void setSelectedWallpaper()}
            disabled={busyNow || !selected}
          >
            {busy === 'set'
              ? t('wallpaper.setting')
              : selected?.type === 'image'
                ? t('wallpaper.set')
                : t('wallpaper.setLive')}
          </button>
          <button
            type="button"
            className="button-danger"
            onClick={() => void removeSelected()}
            disabled={busyNow || !selected}
          >
            {busy === 'remove' ? t('common.removing') : t('common.remove')}
          </button>
        </div>

        <div className="wallpaper-control-group slideshow-controls">
          <label className="wallpaper-check">
            <input
              type="checkbox"
              checked={slideshowEnabled}
              disabled={busyNow || images.length === 0}
              onChange={(event) =>
                void updateSlideshow(
                  event.target.checked,
                  state?.config.intervalMinutes ?? 5,
                  state?.config.shuffle ?? false
                )
              }
            />
            <span>{t('wallpaper.slideshow')}</span>
          </label>
          <label className="wallpaper-field">
            <span>{t('wallpaper.interval')}</span>
            <select
              value={state?.config.intervalMinutes ?? 5}
              disabled={busyNow || images.length === 0}
              onChange={(event) =>
                void updateSlideshow(
                  slideshowEnabled,
                  Number(event.target.value),
                  state?.config.shuffle ?? false
                )
              }
            >
              {WALLPAPER_INTERVAL_MINUTES.map((minutes) => (
                <option value={minutes} key={minutes}>
                  {intervalLabel(minutes)}
                </option>
              ))}
            </select>
          </label>
          <label className="wallpaper-check">
            <input
              type="checkbox"
              checked={state?.config.shuffle ?? false}
              disabled={busyNow || images.length === 0}
              onChange={(event) =>
                void updateSlideshow(
                  slideshowEnabled,
                  state?.config.intervalMinutes ?? 5,
                  event.target.checked
                )
              }
            />
            <span>{t('wallpaper.shuffle')}</span>
          </label>
        </div>

        <div className="wallpaper-control-group live-options">
          <label className="wallpaper-check">
            <input
              type="checkbox"
              checked={liveOptions.pauseOnBattery}
              disabled={busyNow}
              onChange={(event) => void updateLiveOptions({ pauseOnBattery: event.target.checked })}
            />
            <span>{t('wallpaper.pauseOnBattery')}</span>
          </label>
          <label className="wallpaper-check">
            <input
              type="checkbox"
              checked={liveOptions.videoMuted}
              disabled={busyNow}
              onChange={(event) => void updateLiveOptions({ videoMuted: event.target.checked })}
            />
            <span>{t('wallpaper.muteVideos')}</span>
          </label>
          {selected?.type === 'html' && (
            <label className="wallpaper-check">
              <input
                type="checkbox"
                checked={selected.interactive === true}
                disabled={busyNow}
                onChange={(event) => void updateInteractive(event.target.checked)}
              />
              <span>{t('wallpaper.interactive')}</span>
            </label>
          )}
        </div>
      </div>

      {selected && selected.type !== 'image' && (
        <p className="wallpaper-hint">
          {selected.type === 'video' ? t('wallpaper.videoHint') : t('wallpaper.htmlHint')}
        </p>
      )}
      {state?.config.originalWallpaperPath && (
        <p className="wallpaper-original" title={state.config.originalWallpaperPath}>
          {t('wallpaper.original', { path: state.config.originalWallpaperPath })}
        </p>
      )}
    </section>
  )
}

export default WallpaperPanel
