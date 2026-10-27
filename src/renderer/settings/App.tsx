import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type {
  BuiltinWidget,
  GeneralState,
  Notice,
  WidgetManifest,
  WidgetRuntimeInfo,
  WidgetSummary
} from '../../shared/types'
import { t } from '../i18n'
import AboutPanel from './AboutPanel'
import AppAiPanel from './AiPanel'
import AppsPanel from './AppsPanel'
import GeneralPanel from './GeneralPanel'
import Onboarding from './Onboarding'
import { ToastStack } from './Toasts'
import { useToasts } from './useToasts'
import WallpaperPanel from './WallpaperPanel'
import WidgetsPanel from './WidgetsPanel'

type TabId = 'general' | 'widgets' | 'apps' | 'wallpapers' | 'ai' | 'about'
type NavGroup = 'desktop' | 'tools' | 'app'

const DEFAULT_TAB: { id: TabId; label: string; subtitle: string; group: NavGroup } = {
  id: 'general',
  label: 'app.tabs.general',
  subtitle: 'app.tabs.generalBody',
  group: 'desktop'
}

const TABS: Array<{ id: TabId; label: string; subtitle: string; group: NavGroup }> = [
  DEFAULT_TAB,
  {
    id: 'widgets',
    label: 'app.tabs.widgets',
    subtitle: 'app.tabs.widgetsBody',
    group: 'desktop'
  },
  {
    id: 'wallpapers',
    label: 'app.tabs.wallpapers',
    subtitle: 'app.tabs.wallpapersBody',
    group: 'desktop'
  },
  { id: 'apps', label: 'app.tabs.apps', subtitle: 'app.tabs.appsBody', group: 'tools' },
  { id: 'ai', label: 'app.tabs.ai', subtitle: 'app.tabs.aiBody', group: 'tools' },
  { id: 'about', label: 'app.tabs.about', subtitle: 'app.tabs.aboutBody', group: 'app' }
]

const NAV_GROUPS: Array<{ id: NavGroup; label: string }> = [
  { id: 'desktop', label: 'app.nav.desktop' },
  { id: 'tools', label: 'app.nav.tools' },
  { id: 'app', label: 'app.nav.app' }
]

const ICON_PATHS: Record<TabId, string> = {
  general: 'M4 7h9M4 17h5M17 17h3M13 7h7M9 4v6M9 14v6M17 14v6M7 14v6',
  widgets: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  wallpapers: 'M4 5h16v14H4zM4 15l4.5-4.5 4 4L16 11l4 4M15 8.5h.01',
  apps: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
  ai: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM5 16l.6 1.6 1.6.6-1.6.6L5 20.4l-.6-1.6-1.6-.6 1.6-.6z',
  about: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 10v6M12 7h.01'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function initialEditWidgetId(): string | null {
  return new URLSearchParams(window.location.search).get('editWidget')
}

function TabIcon({ id }: { id: TabId }): JSX.Element {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICON_PATHS[id]} />
    </svg>
  )
}

function App(): JSX.Element {
  const [general, setGeneral] = useState<GeneralState | null>(null)
  const [builtins, setBuiltins] = useState<BuiltinWidget[]>([])
  const [widgets, setWidgets] = useState<WidgetSummary[]>([])
  const [savedAiWidgets, setSavedAiWidgets] = useState<WidgetManifest[]>([])
  const [runtime, setRuntime] = useState<WidgetRuntimeInfo[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [editWidgetId, setEditWidgetId] = useState<string | null>(initialEditWidgetId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [tab, setTab] = useState<TabId>(() => (initialEditWidgetId() ? 'ai' : 'general'))
  const workspaceRef = useRef<HTMLDivElement>(null)
  const { toasts, pushToast, dismissToast } = useToasts()

  const refreshWidgets = useCallback(async (): Promise<void> => {
    const [widgetList, savedList] = await Promise.all([
      window.api.getWidgets(),
      window.api.getSavedAiWidgets()
    ])
    setWidgets(widgetList)
    setSavedAiWidgets(savedList)
  }, [])

  const refreshRuntime = useCallback(async (): Promise<void> => {
    setRuntime(await window.api.getWidgetRuntime())
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        const [generalState, builtinList, widgetList, savedList, noticeList, runtimeList] =
          await Promise.all([
            window.api.getGeneralState(),
            window.api.getBuiltins(),
            window.api.getWidgets(),
            window.api.getSavedAiWidgets(),
            window.api.getNotices(),
            window.api.getWidgetRuntime()
          ])
        if (cancelled) {
          return
        }
        setGeneral(generalState)
        setBuiltins(builtinList)
        setWidgets(widgetList)
        setSavedAiWidgets(savedList)
        setNotices(noticeList)
        setRuntime(runtimeList)
      } catch (error) {
        if (!cancelled) {
          setLoadError(messageOf(error))
        }
      }
    }

    void load()

    const offWidgets = window.api.onWidgetsChanged(() => {
      void refreshWidgets().catch(() => undefined)
      void refreshRuntime().catch(() => undefined)
    })
    const offNotices = window.api.onNoticesChanged((noticeList) => {
      if (!cancelled) {
        setNotices(noticeList)
      }
    })
    const offTheme = window.api.onThemeChanged((theme) => {
      if (!cancelled) {
        setGeneral((current) =>
          current
            ? { ...current, theme: theme.theme, resolvedTheme: theme.dark ? 'dark' : 'light' }
            : current
        )
      }
    })

    return () => {
      cancelled = true
      offWidgets()
      offNotices()
      offTheme()
    }
  }, [refreshRuntime, refreshWidgets])

  useEffect(() => {
    const root = document.documentElement
    const resolved =
      general?.resolvedTheme ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    root.dataset['theme'] = resolved
    root.dataset['accent'] = general?.accent ?? 'ember'
    root.dataset['cursor'] = general?.cursorStyle ?? 'system'
  }, [general?.accent, general?.cursorStyle, general?.resolvedTheme])

  useEffect(() => {
    workspaceRef.current?.scrollTo({ top: 0 })
  }, [tab])

  useEffect(() => {
    if (tab !== 'widgets') {
      return
    }
    const timer = window.setInterval(() => {
      void refreshRuntime().catch(() => undefined)
    }, 2000)
    return () => window.clearInterval(timer)
  }, [refreshRuntime, tab])

  const startNormally = async (): Promise<void> => {
    setStarting(true)
    try {
      await window.api.startNormally()
    } catch (error) {
      pushToast(messageOf(error), 'error')
      setStarting(false)
    }
  }

  const openAiEditor = (widgetId: string): void => {
    setEditWidgetId(widgetId)
    setTab('ai')
  }

  if (loadError) {
    return (
      <main className="load-screen">
        <p className="load-error">{t('app.loadError', { error: loadError })}</p>
      </main>
    )
  }

  if (!general) {
    return (
      <main className="load-screen">
        <p className="empty">{t('common.loading')}</p>
      </main>
    )
  }

  if (!general.onboardingCompleted) {
    return (
      <>
        <Onboarding
          builtins={builtins}
          widgets={widgets}
          onComplete={(next) => {
            setGeneral(next)
            void refreshWidgets()
            void refreshRuntime()
          }}
          toast={pushToast}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    )
  }

  const activeTab = TABS.find((entry) => entry.id === tab) ?? DEFAULT_TAB
  const activeGroup = NAV_GROUPS.find((entry) => entry.id === activeTab.group)

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <div>
            <strong>{t('app.name')}</strong>
            <span>{t('app.subtitle')}</span>
          </div>
        </div>

        <nav className="sidebar-nav" role="tablist" aria-label={t('app.sectionsLabel')}>
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.id}>
              <span className="nav-label">{t(group.label)}</span>
              {TABS.filter((entry) => entry.group === group.id).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === entry.id}
                  aria-controls="settings-panel"
                  className={tab === entry.id ? 'nav-item nav-active' : 'nav-item'}
                  onClick={() => setTab(entry.id)}
                >
                  <TabIcon id={entry.id} />
                  <span>{t(entry.label)}</span>
                  {entry.id === 'widgets' && widgets.length > 0 && (
                    <span className="nav-count">{widgets.length}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>
            {t('app.versionLabel')} {general.version}
          </span>
          <span>
            {general.platform} / {general.arch}
          </span>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div className="workspace-heading">
            <span className="eyebrow">{activeGroup ? t(activeGroup.label) : t('app.name')}</span>
            <h1>{t(activeTab.label)}</h1>
            <p>{t(activeTab.subtitle)}</p>
          </div>
          <div className="header-status">
            <span className={general.safeMode ? 'status-pill status-warn' : 'status-pill'}>
              <span className="status-dot" aria-hidden="true" />
              {general.safeMode ? t('app.safeModeShort') : t('app.runningShort')}
            </span>
            <span className="build-value">v{general.version}</span>
          </div>
        </header>

        <div className="workspace-body" id="settings-panel" role="tabpanel" ref={workspaceRef}>
          {general.safeMode && (
            <section className="safe-banner" role="alert">
              <div>
                <strong>{t('app.safe.title')}</strong>
                <span>
                  {general.safeModeReason === 'crashes'
                    ? t('app.safe.crashes', { count: general.failedStarts })
                    : t('app.safe.flag')}
                </span>
              </div>
              <button type="button" onClick={() => void startNormally()} disabled={starting}>
                {starting ? t('app.safe.restarting') : t('app.safe.tryNormal')}
              </button>
            </section>
          )}

          {notices.length > 0 && (
            <section className="notices" aria-live="polite" aria-label={t('app.noticesLabel')}>
              {notices.map((notice) => (
                <div className={`notice notice-${notice.level}`} key={notice.id}>
                  {notice.message}
                </div>
              ))}
            </section>
          )}

          {tab === 'general' && (
            <GeneralPanel general={general} onGeneral={setGeneral} toast={pushToast} />
          )}
          {tab === 'widgets' && (
            <WidgetsPanel
              widgets={widgets}
              builtins={builtins}
              savedAiWidgets={savedAiWidgets}
              runtime={runtime}
              general={general}
              onRefresh={refreshWidgets}
              onEditWithAi={openAiEditor}
              onOpenAiStudio={() => {
                setEditWidgetId(null)
                setTab('ai')
              }}
              toast={pushToast}
            />
          )}
          {tab === 'apps' && <AppsPanel toast={pushToast} />}
          {tab === 'wallpapers' && <WallpaperPanel />}
          {tab === 'ai' && (
            <AppAiPanel
              key={editWidgetId ?? 'new'}
              editWidgetId={editWidgetId}
              onChanged={() => {
                void refreshWidgets()
                void refreshRuntime()
              }}
            />
          )}
          {tab === 'about' && <AboutPanel general={general} toast={pushToast} />}
        </div>
      </section>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </main>
  )
}

export default App
