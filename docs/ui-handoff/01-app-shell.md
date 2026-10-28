# 01 — App Shell (window chrome, sidebar, header, notices, toasts)

**Source:** `src/renderer/settings/App.tsx`, `Toasts.tsx`, `useToasts.ts`
**Styles:** `main.css` — `.app-shell`, `.sidebar`, `.workspace`, `.workspace-header`,
`.workspace-body`, `.safe-banner`, `.notices`, `.status-pill`, `.toast-stack`
**Also read:** `README.md` (tokens and constraints)

## 1. Purpose

This is the persistent frame around every settings section. It tells users where they
are, what the app is doing (running / safe mode), and surfaces system notices and
transient action feedback. It must stay out of the way: the active section is the
hero, not the chrome.

## 2. Current layout

```
┌──────────────────────────── 880 × 620 window ─────────────────────────────┐
│ ┌─ sidebar 208 ──────────┐ ┌─ workspace ────────────────────────────────┐ │
│ │ ●●●●  HomeLayer        │ │ DESKTOP                        ● Running  │ │
│ │       Desktop settings │ │ General                          v1.4.2   │ │
│ │                        │ │ Startup, appearance and maintenance…       │ │
│ │ DESKTOP                │ │ ────────────────────────────────────────── │ │
│ │ ▣ General        [act] │ │                                            │ │
│ │ ▣ Widgets          3   │ │  [safe-mode banner, if enabled]            │ │
│ │ ▣ Wallpaper            │ │  [notice stack, if present]                │ │
│ │ TOOLS                  │ │                                            │ │
│ │ ▣ Apps and bundles     │ │  <active panel>                            │ │
│ │ ✦ AI                   │ │                                            │ │
│ │ APP                    │ │                                            │ │
│ │ ◉ About                │ │                                            │ │
│ │                        │ │                                            │ │
│ │ Version 1.4.2          │ │                                            │ │
│ │ win32 / x64            │ │                                            │ │
│ └────────────────────────┘ └────────────────────────────────────────────┘ │
│                                                    [toast] [toast]        │
└───────────────────────────────────────────────────────────────────────────┘
```

The body has a soft radial accent glow behind the workspace. The sidebar has a
blurred accent orb at its top-left, a subtle vertical gradient, and a 1 px divider on
its right edge.

## 3. Component inventory

| Component | File | Role | Key state / props |
|---|---|---|---|
| `App` | `App.tsx` | Loads all settings data; owns tab + edit-widget routing | `general`, `builtins`, `widgets`, `savedAiWidgets`, `runtime`, `notices`, `editWidgetId`, `loadError`, `starting`, `tab` |
| `TabIcon` | `App.tsx` | Inline SVG per nav item | 24×24, 1.8 px stroke |
| `Sidebar` (inline) | `App.tsx` | Brand, grouped nav, footer | active `tab`; widgets count badge |
| `WorkspaceHeader` (inline) | `App.tsx` | Eyebrow, h1, subtitle, status pill, version | active tab metadata, `general.safeMode` |
| `SafeBanner` (inline) | `App.tsx` | Explains safe mode and offers "Start normally" | `safeModeReason` (`flag`/`crashes`), `failedStarts`, `starting` |
| `Notices` (inline) | `App.tsx` | Live list from main process | `Notice[]`, `aria-live="polite"` |
| `ToastStack` | `Toasts.tsx` | Transient success/error/info feedback | `toasts`, `onDismiss`, 5 s timeout, max 4 visible |
| `useToasts` | `useToasts.ts` | Toast queue | `pushToast(message, level)`, `dismissToast(id)` |

## 4. Copy and navigation

Nav groups and section titles come from `app.nav.*` and `app.tabs.*`:

| Tab | Nav label | Header h1 | Subtitle |
|---|---|---|---|
| general | General | General | Startup, appearance and maintenance for the whole app. |
| widgets | Widgets | Widgets | Browse live designs, then manage what is on your desktop. |
| wallpapers | Wallpaper | Wallpaper | Set a still, video or interactive HTML backdrop. |
| apps | Apps and bundles | Apps and bundles | Review discovered apps and the bundles made from them. |
| ai | AI | AI | Describe a widget and preview it before anything is saved. |
| about | About | About | Version, licenses and recovery tools. |

Brand: **HomeLayer**, subtitle **Desktop settings**. Footer:
`Version {version}` and `{platform} / {arch}`. Header status pill: **Running** or
**Safe mode**; version repeated as `v{version}`.

Safe mode copy:
- Title **Safe mode is on**
- Reason (crashes): *Widgets and live wallpapers were skipped because HomeLayer failed
  to start {count} times in two minutes.*
- Reason (flag): *Widgets and live wallpapers were skipped because HomeLayer was
  started with --safe.*
- CTA **Start normally** → **Restarting...**

Toast dismiss label: **Dismiss notification**. Toast variants: info (neutral),
success (green icon/edge), error (red). Auto-dismiss after 5 s; newest last; the
fourth-oldest is dropped.

## 5. Behaviour and data contract

- On mount, `App` fetches `getGeneralState`, `getBuiltins`, `getWidgets`,
  `getSavedAiWidgets`, `getNotices`, `getWidgetRuntime` in parallel.
- Subscribes to `onWidgetsChanged`, `onNoticesChanged`, `onThemeChanged`.
- Applies `data-theme`, `data-accent`, `data-cursor` to `<html>`, and sets a
  custom cursor via `--hl-app-cursor`.
- Widgets tab polls runtime every 2 s.
- Scrolls the workspace to top on tab change.
- `?editWidget=<id>` opens the AI tab with that widget selected.
- If `onboardingCompleted` is false, the entire shell is replaced by `Onboarding`.
- If loading fails, a full-window `.load-error` message is shown.
- Safe-mode "Start normally" calls `startNormally()`; no optimistic UI.
- Any section can call `pushToast(message, level)`. Toasts are the only global
  feedback channel; errors from panel-level actions usually also appear inline.

**Do not change:** tab ids, nav grouping semantics, default tab, deep link
`editWidget`, widget-count badge, safe-mode CTA behaviour, notice text (comes from
main), toast API.

## 6. Current styling notes

- Sidebar: 208 px; padding 26 px 18 px 20 px; `.nav-item` is a 36 px row with 17 px
  icon, 12 px label, 10 px count pill; active state is an accent-tinted rectangle
  with a 2 px inset accent bar on the left and 1 px accent border.
- Nav group labels are 9 px uppercase with 0.16em tracking and large top gaps.
- Workspace header: 30 px h1, 12 px muted subtitle, 9 px uppercase eyebrow; status
  pill 10 px with a live dot; version in 10 px mono.
- Body: max-width none; content panels stack with 14 px gaps; bottom padding 36 px.
- Safe banner: warning-tinted panel with 3 px left bar, stacked title/body, CTA at
  the right; collapses to column below 620 px.
- Notices: 11 px inline strips with colored left border; not dismissible.
- Toasts: fixed bottom-right 18 px, 300 px max width, dark raised panel,
  12 px text, colored left edge, dismiss button 18 px.

## 7. UX observations (from audit)

1. The header repeats the brand context twice (eyebrow group + h1) and the version
   twice (header + sidebar). This is a lot of chrome for a small window.
2. Sidebar and header both compete for attention; the active section title is large
   but the eye lands on the bright status pill and accent orb first.
3. The "Running" pill is always-on and mostly meaningless (the app is obviously
   running); it only becomes useful in safe mode.
4. Notices are not dismissible and can push the panel down on every launch.
5. Sidebar footer uses two tiny mono lines; platform info is rarely useful.
6. Nav has no collapse behaviour beyond shrinking; at 720 px width, labels still fit,
   but the widget count and hotkey-free header get tight.
7. Toasts overlay content at the bottom-right and are not grouped by severity; on
   error-heavy flows they stack over the primary action.
8. The shell has no global "edit layout" or "open AI" shortcut; those live inside
   Widgets. Users must remember where to go.

## 8. Design brief for the AI

Redesign the shell to feel like a focused desktop creative tool:

- Keep the 6 sections and 3 groups; propose a clearer hierarchy than "eyebrow + h1 +
  subtitle + pill + version" in a 60 px header.
- Make the active section unmistakable without over-using accent color.
- Treat safe mode as the only high-priority global state; demote normal "Running" to
  a quiet indicator or remove it.
- Give notices a compact, dismissible presentation that does not shift the whole
  panel; preserve the main-process text.
- Rework the sidebar footer and brand mark to feel intentional, not placeholder.
- Define a toast pattern that stays readable over dense panels, supports 1–4 stacked
  messages, and has a clear dismiss affordance.
- Keep the shell usable at 720 × 520; specify how the sidebar compresses (labels,
  counts, footer) and what hides first.
- Keep tab order and ARIA roles; every nav item remains a `role="tab"` with
  `aria-selected`.
- Do not add a command palette, router, or new global state library.

## 9. Output format

Return:
1. Updated `App.tsx` (or a small set of extracted shell components) + CSS additions
   scoped under `.app-shell` / `.sidebar` / `.workspace`.
2. A short table of any copy keys added to `en.json`.
3. Notes on what changed for keyboard users and at 720 px width.
4. No new dependencies, no remote assets, no changes to IPC or tab ids.
