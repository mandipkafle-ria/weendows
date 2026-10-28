# 04 — Wallpaper

**Source:** `src/renderer/settings/WallpaperPanel.tsx`
**Styles:** `main.css` — `.wallpaper-panel`, `.wallpaper-actions`, `.wallpaper-grid`,
`.wallpaper-card`, `.wallpaper-thumb`, `.wallpaper-controls`, `.wallpaper-field`,
`.wallpaper-check`, `.wallpaper-hint`, `.wallpaper-original`
**Data:** `WallpaperState`, `WallpaperConfig`, `WallpaperItem` in `src/shared/types.ts`;
fits and intervals in `src/shared/wallpaper-fit.ts`

## 1. Purpose

Manage the wallpaper library and choose what sits behind the desktop: a still image,
a looping video, an interactive HTML scene, or a slideshow of imported images. The
screen must make three modes easy to distinguish and must keep "restore Windows
wallpaper" obvious.

## 2. Current layout

```
Wallpaper
Set a still, video or interactive HTML backdrop.                ● Running  v1.4.2
──────────────────────────────────────────────────────────────────────────────
┌─ Wallpaper library                                   2 saved ─────────────┐
│ Imported wallpapers are copied into the HomeLayer data folder…            │
│ [Add images/videos] [Add HTML folder] [Restore Windows wallpaper]         │
│ (status / error message here)                                             │
│                                                                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                        │
│ │ [IMAGE]      │ │ [VIDEO]      │ │  HTML        │                        │
│ │ Image        │ │ Video  Current│ │ HTML         │                        │
│ │ forest.jpg   │ │ loop.mp4     │ │ scene        │                        │
│ └──────────────┘ └──────────────┘ └──────────────┘                        │
│                                                                            │
│ Fit [Fill v] [Set] [Remove]                                                │
│ [ ] Slideshow   Interval [5 min v]   [ ] Shuffle                           │
│ [ ] Pause on battery   [ ] Mute videos   [ ] Interactive (HTML only)       │
│ Video wallpapers loop behind desktop icons…                                │
│ Original wallpaper: C:\Users\…\wallpaper.jpg                               │
└────────────────────────────────────────────────────────────────────────────┘
```

Everything lives in a single tall panel. There is no separate detail view, and the
selected item is only indicated by a border on the card.

## 3. Component inventory

| Element | Details |
|---|---|
| Header | Title, long explanatory body, saved count |
| Add images/videos | File picker; multi-select; copies into app data folder |
| Add HTML folder | Selects a folder containing an HTML wallpaper (e.g. `index.html`) |
| Restore Windows wallpaper | Disabled if no original path recorded |
| Action message | One line, green status or red error; `role="status"` |
| Grid | Responsive auto-fill; each item is a `<button>` card |
| Card preview | `hl-wallpaper://thumb/{id}` 16:9 image; HTML always generic text; on image error shows **Preview unavailable** |
| Card badges | Type chip bottom-left (Image/Video/HTML); **Current** top-right |
| Card label | Name, one line, ellipsis with title |
| Fit | `<select>`; all 6 fits for images, 4 for live (`Fill`, `Fit`, `Stretch`, `Center`) |
| Set / Set live | Primary; applies selected item with chosen fit |
| Remove | Danger; native confirm; removes from library |
| Slideshow | Checkbox; enabling/disabling calls the API immediately |
| Interval | `1 min`, `5 min`, `15 min`, `30 min`, `60 min`, `Daily` |
| Shuffle | Checkbox; immediate |
| Pause on battery | Live option; immediate |
| Mute videos | Live option; immediate |
| Interactive | Only for HTML; immediate; enables mouse movement forwarding |
| Hints | Video memory/bandwidth warning; HTML sandbox/network warning |
| Original path | Truncated path with full path in `title` |
| Busy | One shared `busy` string disables all buttons/selects |

## 4. Copy inventory

- **Wallpaper library** · **Imported wallpapers are copied into the HomeLayer data
  folder. Originals are never moved or changed. Video and HTML wallpapers play as live
  wallpapers behind desktop icons.**
- `{count} saved`
- **Add images/videos** → **Adding...**
- **Add HTML folder** → **Adding...**
- **Restore Windows wallpaper** → **Restoring...**
- **Loading wallpaper library...**
- **No wallpapers yet. Add an image or video to get started.**
- **Preview unavailable**
- **Current**
- Types: **Image**, **Video**, **HTML**
- **Fit**; **Fill**, **Fit**, **Stretch**, **Tile**, **Center**, **Span**
- **Set** → **Setting...**; **Set live** → **Setting...**
- **Remove** → **Removing...**; confirm **Remove "{name}" from the wallpaper library?**
- **Slideshow**, **Interval**, **Shuffle**, **Pause on battery**, **Mute videos**,
  **Interactive**
- Video hint: **Video wallpapers loop behind desktop icons. Large or high-resolution
  files may use more memory and disk bandwidth.**
- HTML hint: **HTML wallpapers run in a sandboxed frame with no network access.
  Interactive HTML receives mouse movement while it is the live wallpaper.**
- **Original wallpaper: {path}**
- Toasts/status: **{count} wallpaper added.** / **{count} wallpapers added.** /
  **HTML wallpaper folder added.** / **Wallpaper removed.** / **Wallpaper applied.** /
  **Live wallpaper started.** / **Slideshow started.** / **Slideshow stopped.** /
  **Windows wallpaper restored.**

## 5. Behaviour and data contract

- Initial load: `getWallpaperState()`; also subscribes to `onWallpaperChanged`.
- Selection: explicit `selectedId`, falling back to `config.currentId`, then the first
  item. So the UI always has a "selected" item even if the user never clicked.
- Fit select: stores per-item in local `fits` state; it is **not persisted** until
  **Set**. Switching cards keeps prior local choices. Live items with a non-live fit
  display `Fill`.
- **Set** → `setStaticWallpaper(id, fit)` for images; `setLiveWallpaper(id, fit)` for
  video/HTML.
- Remove → `removeWallpaper(id)`; selected item returns to current/first afterwards.
- Add → `addWallpapers()` (multi-file); `addWallpaperFolder()`; count difference
  produces the status message.
- Restore → `restoreOriginalWallpaper()`; enabled only when
  `config.originalWallpaperPath` exists.
- Slideshow → `setWallpaperSlideshow({enabled, intervalMinutes, shuffle})` on every
  change; disabled when there are zero images; uses all image items implicitly.
- Live options → `setWallpaperLiveOptions({pauseOnBattery, videoMuted})`.
- Interactive → `setWallpaperInteractive(id, bool)` only for HTML.
- All actions share one `busy` state; the UI blocks the entire panel while any single
  action runs.
- `config` also contains `slideshowIds` and `pauseOnFullscreen`, which are **not exposed**
  in this UI. Do not invent a UI for them unless noted as future work.

`WallpaperState`:
`items[]` (`id`, `name`, `type`, `file`, `fit`, `posterFile?`, `interactive?`) and
`config` (`mode` = `static|slideshow|live`, `currentId`, `slideshowIds`,
`intervalMinutes`, `shuffle`, `pauseOnFullscreen`, `pauseOnBattery`, `videoMuted`,
`originalWallpaperPath`, `originalWallpaperStyle`, `originalWallpaperTile`,
`lastChangeAt`).

The live rendering is a separate window (`wallpaper-host`, see `09-desktop-layer.md`):
image → `<img>`; video → looping muted `<video>` with pause events; HTML → sandboxed
iframe with `hl-pause` / `hl-mouse` messages. Thumbnails come from
`hl-wallpaper://thumb/<id>`; HTML has no generated thumbnail.

## 6. Current styling notes

- Panel: standard 14 px radius, 22 px padding; header body is long (two lines at full
  width).
- Action row: primary first, two secondary buttons, 8 px gap, wraps.
- Grid: `repeat(auto-fill, minmax(180px, 1fr))`, 12 px gap; cards are 13 px radius,
  1 px border; preview is 16:9 with dark fallback; selected card gets accent border +
  inner ring; `Current` badge is small uppercase on a translucent dark pill; type chip
  is bottom-left uppercase 8 px.
- Controls: three groups separated by 1 px lines; labels 10 px; selects 28 px tall;
  checkboxes are native (accent color); the Set/Remove buttons align with the fit
  select.
- Hints 10 px muted; original path 9.5 px mono, ellipsized.
- The panel can grow taller than the window; the workspace scrolls.

## 7. UX observations

1. **Mode is not explicit.** Users cannot tell at a glance whether the current setup is
   static, slideshow, or live; the only clue is a **Current** badge and button labels.
2. **Apply is indirect.** Selecting a card does not preview or apply it. Fit is a local
   draft, and **Set** is separated from the card. It is easy to change Fit, switch
   cards, and apply the wrong combination.
3. **No image preview.** Cards are cropped 16:9 and there is no lightbox or larger
   preview; HTML items have no visual identity at all.
4. **Slideshow is a checkbox plus two selects** disconnected from the library; it uses
   all images (there is no selection UI), and “Slideshow” turning on/off immediately
   while “Set” is separate is confusing.
5. **Restore is duplicated** in About and here, and its disabled state is explained
   only by absence of a path.
6. **Remove has a native confirm** and the remove button sits next to **Set**; a
   mis-click requires dismissing a dialog.
7. **Shared busy state** makes unrelated controls flicker/disable during any add or
   apply, including while a file dialog is open.
8. **HTML is second-class**: no thumbnail, generic label, separate "Add HTML folder"
   affordance, and the interactive option appears/disappears based on selection.
9. **No drag-and-drop**, no multi-select, no sorting, no renaming, no file metadata
   (resolution, size, duration), no duplicate detection.
10. **Empty state has no CTA** inside it; the buttons are above, which is fine but the
    dashed empty pattern used elsewhere is not used here.
11. **Original wallpaper path** is raw OS path text; users rarely need it and it adds
    visual noise.
12. **"Pause on battery"** and **"Mute videos"** are always visible even when no video
    is selected; `pauseOnFullscreen` is hidden entirely.

## 8. Design brief for the AI

Make wallpaper feel like a media library with a clear active mode:

- Structure the screen around **mode** (Static / Slideshow / Live) and a **library**
  grid. Show the current mode, current item, fit, and (for slideshow) interval in a
  compact "Now showing" summary with a preview.
- Make card interaction direct: hover reveals Set / Preview / Remove; clicking opens a
  detail/preview panel with a large preview, name, type, dimensions/duration if
  available, fit, and a primary Apply. Avoid the detached bottom control strip.
- Use a proper empty state with an illustration/dropzone: drag files in, or choose
  images/videos/HTML folder. Keep the current copy about copying files.
- For slideshow, provide a dedicated setup (selected images, interval, shuffle,
  enable/disable, start) instead of a checkbox mixed into general controls. If the
  backend only supports all images, say so clearly rather than implying selection.
- Group live options with the live item (pause on battery, mute, interactive) and
  show them contextually; explain the HTML sandbox/network rules.
- Move **Restore Windows wallpaper** into a clear recovery affordance (and keep the
  duplicate in About or remove it there); show the original path only on demand.
- Replace native confirm with an inline or undo-based remove. Preserve the
  main-process confirm if required, but design the trigger as a deliberate overflow
  action.
- Show busy state only on the affected card/action, not the whole panel.
- Keep all API calls and config semantics. Do not add fields such as per-slideshow
  selection unless marked future.

## 9. Output format

Return `WallpaperPanel.tsx` + CSS scoped to `.wallpaper-*`. Keep `getWallpaperState`,
`onWallpaperChanged`, and all setter call signatures. Provide i18n keys for new copy.
Show the layout at 880 × 620 and 720 × 520.
