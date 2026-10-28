# 05 — Apps and bundles

**Source:** `src/renderer/settings/AppsPanel.tsx`
**Data:** `AppsAndBundlesState`, `AppEntry`, `AppBundleSummary`, `AppGridWidgetOption`
in `src/shared/types.ts`
**Styles:** mostly **inline styles**; shared classes `.panel`, `.section-head`,
`.stat-strip`, `.app-list`, `.app-row`, `.bundle-list`, `.bundle-row`, `.bundle-chip`,
`.button-*`, `.search`

## 1. Purpose

Show what HomeLayer discovered in the Windows Start menu, let users place an app into
a desktop Apps grid (app-grid widget), and create/manage bundles (folders of apps
inside a grid). It is the bridge between the OS app list and the desktop launcher.

## 2. Current layout

```
Apps and bundles
Review discovered apps and the bundles made from them.          ● Running  v1.4.2
──────────────────────────────────────────────────────────────────────────────
┌─ Apps and bundles ─────────────────────────────────────────────────────────┐
│ See what HomeLayer found in your Start menu…                               │
│      [+ Add Apps widget to desktop] [+ Create bundle] [Rescan Start menu]  │
│ [42 apps] [3 hidden] [2 bundles] [Last scan: Oct 26, 2026, 09:14]          │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Discovered apps ─────────────────────────────────── [Search apps…      ] ┐
│ Names come from Start menu shortcuts. Hidden system entries are excluded…  │
│                                                                            │
│ Chrome                                      lnk      [+ Add to desktop]     │
│ Files                                       uwp      [+ Add to desktop]     │
│ Spotify                                     lnk      [+ Add to desktop]     │
│ …                                                                          │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Bundles ─────────────────────────────────────────────── [+ Create bundle] ┐
│ Bundles created inside app-grid widgets.                                   │
│ Work · 4 apps                                          [+ Add to desktop] [×]│
│ [Word] [Excel] [Slack] [Teams]                                              │
│ …                                                                          │
└────────────────────────────────────────────────────────────────────────────┘

MODALS
┌─ Create new bundle ─────────────────────────────────────────────── ✕ ─────┐
│ Bundle name   [ e.g. Work, Games, Utilities                ]               │
│ Select apps (3)                                  [Search apps…       ]     │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ [x] Chrome             lnk                                           │ │
│ │ [ ] Files              uwp                                           │ │
│ │ …                                                                     │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│ Destination widget on desktop                                             │
│ [Work grid (grid-123) v] / + Create new Apps widget / Save in library only │
│                                              [Cancel] [Create bundle]      │
└───────────────────────────────────────────────────────────────────────────┘

┌─ Choose Target Apps Widget ───────────────────────────────────────────────┐
│ Which desktop Apps widget should "Chrome" be added to?                    │
│ [ Work grid                         grid-123 ]                            │
│ [ Apps                               grid-456 ]                            │
│ [ + Create new Apps widget on desktop ]                                   │
│                                                              [Cancel]      │
└───────────────────────────────────────────────────────────────────────────┘
```

## 3. Component inventory

| Area | Element | Behaviour |
|---|---|---|
| Header | Add Apps widget | Calls `addWidget('app-grid')`; loading label is **Loading...**; toast uses a hardcoded `'Apps'` name |
| Header | Create bundle | Opens modal, resets name + selection only |
| Header | Rescan Start menu | `refreshApps()`; stat shows **Scanning the Start menu...**; success toast |
| Stat strip | Apps / hidden / bundles / last scan | Counts derive from state; last scan formatted `toLocaleString` |
| Apps list | Search | Local filter by name, case-insensitive; 220 px inline-styled input |
| Apps list | Row | Name, kind (`lnk`/`uwp`/`steam`), **+ Add to desktop** |
| Apps list | Add | If >1 grid widget → target picker; else add to first grid (or undefined → backend decides). No "library only" option here |
| Bundles | Create | Same modal via `openCreateModal()` |
| Bundles | Row | Name, `{grid} · {count} apps`, **+ Add to desktop**, **×** delete |
| Bundles | Chips | App names, wrapping |
| Create modal | Name | Required, max 24 chars, autofocus; blank name → info toast |
| Create modal | App selection | Searchable checkbox list; label shows selected count; no select-all; no icons |
| Create modal | Destination | All grid widgets by title + widgetId, `+ Create new Apps widget on desktop`, `Save in library only (don't place on desktop)` |
| Create modal | Actions | Cancel / Create bundle (disabled until name + ≥1 app); errors via toast |
| Picker modal | Target | One button per grid widget (title + id), plus create-new; backdrop click closes; no Escape handling |
| Picker modal | Actions | Cancel |

Hidden apps are excluded everywhere; `hiddenCount` is shown but there is no way to
review or unhide hidden apps. `AppEntry.iconUrl` exists in the data model but is not
rendered.

## 4. Copy inventory

- **Apps and bundles** · **See what HomeLayer found in your Start menu and how your app
  grids are organised.**
- **Rescan Start menu** · **Scanning the Start menu...** · **Last scan: {date}** ·
  **Not scanned yet**
- **{count} apps**, **{count} hidden**, **{count} bundles**
- **Discovered apps** · **Names come from Start menu shortcuts. Hidden system entries
  are excluded from app grids.** · **No apps found yet. Rescan the Start menu.**
- **Bundles** · **Bundles created inside app-grid widgets.** · **No bundles yet. Create
  one from an app-grid widget.**
- **{grid} · {count} apps**
- **Hidden** (key exists, unused)
- **Start menu scan complete.**
- **Could not scan the Start menu: {error}**
- **Add to desktop** · **Added {name} to desktop.**
- **Create bundle** · **Create new bundle** · **Bundle name** ·
  **e.g. Work, Games, Utilities** · **Select apps** · **Search apps...**
- **Create & add to desktop** (key exists, unused)
- **Bundle "{name}" created.** · **Bundle "{name}" removed.**
- **Delete bundle** · Confirm **Delete bundle "{name}"? The apps will remain on your
  system.**
- **Add Apps widget to desktop** · **{name} added to desktop apps widget.**
- **Destination widget on desktop** · **Choose which widget to place this in:**
- **+ Create new Apps widget on desktop** · **Save in library only (don't place on
  desktop)**
- **Choose Target Apps Widget** · **Which desktop Apps widget should "{name}" be added
  to?** · **"{title}" ({id})**

## 5. Behaviour and data contract

- Load: `getAppsAndBundles()` on mount; stores state; preselects the first grid widget
  as destination.
- Rescan: `refreshApps()` returns full state; error appears inline and as toast.
- Add app: `addAppToHomescreen(appId, widgetId?)`; then refetch state; toast.
- Add bundle: `addBundleToHomescreen(bundleId, widgetId?)`; then refetch; toast.
- Create: `createBundle(name, appIds[], targetGridId)` where target may be a widget id,
  `__new__`, or `none`. Header path may leave a stale destination because it does not
  call `openCreateModal()`.
- Delete: `deleteBundle(id)` after native confirm; toast.
- Add grid: `addWidget('app-grid')`; toast uses the literal string `'Apps'` rather
  than the localized catalog name.
- State refetch after every mutation; no optimistic list updates.

State:
```ts
AppsAndBundlesState = {
  apps: AppEntry[] ({ id, name, kind: 'lnk'|'uwp'|'steam', hidden, iconUrl })
  hiddenCount: number
  bundles: AppBundleSummary[] ({ id, gridId, gridTitle, name, apps[] })
  scanning: boolean
  lastScanAt: string | null
  gridWidgets?: AppGridWidgetOption[] ({ widgetId, title, enabled })
}
```

## 6. Current styling notes (and debt)

- The two list panels use shared `.app-list` / `.bundle-list` styles; most other layout
  and controls are **inline styles** with hardcoded sizes (220 px search, 520 px modal,
  160 px modal search, 260 px list height).
- The modals reference undefined CSS variables: `--border-focus`, `--panel-solid`,
  `--panel-active`. These declarations are invalid, so borders/backgrounds fall back
  to defaults; the result is inconsistent with `AiPanel`'s `.ai-modal`.
- Create modal backdrop: `rgba(0,0,0,.65)` + 8 px blur; panel 16 px radius; 24 px
  padding; `--shadow`-like 24/60 black shadow.
- Picker modal is narrower (380 px) and uses a dashed accent "create new" button.
- App rows are plain text; no icons, no hover reveal, no selected state.
- Buttons use compact variants (5×9 px padding, 10 px text); delete is a bare `×`.
- Stats are small pill-shaped chips in a horizontal strip; last scan can be long.
- Inline-styled inputs do not share focus rings with the rest of the app.

## 7. UX observations

1. **No app icons** despite `iconUrl`, so a long list is hard to scan; rows are
   text-heavy and visually flat.
2. **Three competing "create" actions**: header add widget, header create bundle, and
   bundles-panel create bundle. The last two are duplicates with different reset
   behaviour.
3. **Destination is confusing**: adding a single app silently targets the first grid
   when there is exactly one (or zero), shows a picker when there is more than one,
   and never offers "library only" outside the bundle modal.
4. **No visibility into hidden apps**; the count is inert. Users cannot fix a missing
   app from here.
5. **Bundles are created here but the copy says "inside app-grid widgets"**; no
   explanation of the relationship between a bundle and its grid. Bundle rows show a
   grid title but no navigation to it.
6. **The modal is inaccessible**: no `aria-labelledby`/label for the dialog, close
   `✕` lacks an accessible name, no focus trap, no Escape handling, background remains
   interactive to screen readers.
7. **Destructive delete is a bare `×`** next to add, using a native confirm.
8. **No editing**: rename, add/remove apps from a bundle, move a bundle, or change its
   destination.
9. **Large lists render fully** with no virtualization or sorting; search is the only
   affordance.
10. **Empty states are plain sentences** and the bundles empty state tells users to go
    to an app-grid widget, even though this screen can create bundles.
11. **Mixed language and formatting**: "e.g. Work…" placeholder, `+` prefixes
    hardcoded, `Loading...` used for an add action, hardcoded `'Apps'` toast.
12. **Undefined tokens** in modals create visual inconsistency and silent bugs.

## 8. Design brief for the AI

Redesign Apps and bundles as an app library with a clear flow into the desktop:

- **Header**: one primary action (**Add apps widget**) and one secondary (**Create
  bundle**), plus a single rescan affordance with last-scan metadata. Remove
  duplicated create buttons.
- **App list**: show icons, a clean search field with clear button, and a row action
  that opens a small "Add to…" menu (existing grid(s), new grid, library only). Show
  which grids already contain the app. Consider sorting (A–Z / recently discovered)
  and a virtualized or paginated list for large Start menus.
- **Hidden apps**: surface a filter or a small "N hidden" disclosure that lists them
  and explains why they are excluded (do not add new backend behaviour; use existing
  `hidden`/`hiddenCount`).
- **Bundles**: present as cards or rows with a mini app-icon stack, grid association,
  app count, and an overflow menu (Add to desktop, Rename/Edit if future, Delete).
  Replace the bare `×` with a labeled destructive action and inline confirmation.
- **Bundle builder**: make it a focused modal with a two-pane layout (apps to choose /
  selected apps), search, select-all/clear, a destination selector with explanations,
  and a summary of the result. Fix reset behaviour and keyboard/ARIA support.
- **Target picker**: reuse the bundle destination component; show enabled/disabled
  grids and explain where the app will appear.
- Replace all inline styles with shared classes; define the missing tokens or use
  existing ones.
- Keep every IPC call, the `__new__`/`none` target values, hidden exclusion, and
  state-refetch behaviour.

## 9. Output format

Return updated `AppsPanel.tsx` (and any extracted modal/list components) + CSS. Use
existing design tokens; do not add dependencies. List new i18n keys and any changes to
keyboard/focus handling. Ensure `npm run typecheck` and `npm run lint` pass.
