# Phase 5 App Grid results

- Date: 2026-10-26
- Status: Implementation complete; automated acceptance passed. Manual-only checks and owner
  approval pending.
- Build: packaged `dist/win-unpacked/HomeLayer.exe`
- Windows: 10.0.26200 x64
- Electron: 44.9.3
- Scaling: 125 percent for the main packaged run; 100 and 150 percent for the scale run
- Test profile: temporary `--user-data-dir` directories. The owner's normal
  `%APPDATA%\HomeLayer` layout and Gemini key were not changed or read.

## Gates

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm test`: PASS, 15 files / 138 tests
- `npm run build`: PASS
- `npm run build:unpack`: PASS

## Automated coverage

The Vitest suite covers scanner filtering and de-duplication with mocked directories, target
icon extraction and cache invalidation, missing-target icons, UWP manifest icon variants,
classic shortcut icon-location fallback, Steam manifest parsing and library scanning, Steam URL
launching, editable grid-title persistence, bundle merge and dissolve, bundle removal, grid
reorder, and the id-only IPC validation.

The packaged smoke suite ran 24 checks against the built app. All 24 passed. It used a fresh
temporary profile, added the App Grid, scanned the real Start Menu, exercised picker, bundles,
popover, persistence, 60-app scrolling, and memory measurement.

| Check                                           | Result | Evidence                                                                                        |
| ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| Startup is not blocked by the app scan          | PASS   | Settings opened before the background scan completed.                                           |
| App Grid can be added from the gallery          | PASS   | Widget loaded through `widget://`.                                                              |
| Initial empty state is loaded                   | PASS   | `No apps found` appeared before the scan.                                                       |
| First scan lists installed apps                 | PASS   | 184 apps; 167 visible picker rows; 17 hidden entries.                                           |
| Apps can be added                               | PASS   | 13 grid items.                                                                                  |
| Icons or letters render for every tile          | PASS   | 12 target/UWP/Steam icons and 1 letter tile; no `hl-icon` 404s.                                 |
| Picker search filters and disables present apps | PASS   | Query `Abo` reduced 167 rows to 1 and greyed out the existing app.                              |
| Fake ids and paths are rejected                 | PASS   | Path returned `invalid_args`; fake id returned `not_found`; nothing launched.                   |
| Dropping one app on another creates a bundle    | PASS   | 13 items became 12, including a bundle.                                                         |
| Dropping an app on a bundle adds it             | PASS   | Bundle grew to 3 apps; grid had 11 items.                                                       |
| Bundle popover opens                            | PASS   | Separate `popover.html` window opened over the tile.                                            |
| Popover uses three columns and dynamic height   | PASS   | 280 px wide, 156/157 px tall, three 78.8 px columns.                                            |
| Bundle apps reorder by dragging                 | PASS   | First two app ids swapped.                                                                      |
| Bundle title renames                            | PASS   | Renamed to `Work`.                                                                              |
| Escape closes the popover                       | PASS   | Popover window was gone.                                                                        |
| Focusing the grid closes the popover            | PASS   | After the 150 ms blur grace, focusing the App Grid closed it.                                   |
| Removing from a larger bundle keeps the bundle  | PASS   | 2 apps remained; the removed app returned to the grid.                                          |
| A second bundle can be created                  | PASS   | New `Bundle` item appeared.                                                                     |
| Removing from a two-app bundle dissolves it     | PASS   | Bundle removed, popover closed, standalone tiles went from 9 to 11.                             |
| 60 apps render with internal scrolling          | PASS   | 72 tiles; `clientHeight` 213; `scrollHeight` 2584.                                              |
| Picker Add adds a selected app                  | PASS   | Memory Diagnostics Tool; 72 to 73 items.                                                        |
| Grid and bundle state are written               | PASS   | `grids.json` 7889 bytes; `groups.json` 308 bytes.                                               |
| Memory is measurable with 60 apps               | PASS   | 188 MB total across the Clock and App Grid renderers; App Grid about 103 MB, Clock about 85 MB. |
| Bundles persist across restart                  | PASS   | 73 items and the `Work` bundle restored.                                                        |

## Popover edge and scaling checks

The packaged edge test opened the popover from the centre and all four work-area corners. All
five positions stayed inside the 1536 by 864 work area. The centre bounds were exactly
`(200, 270)`; corner cases clamped to `(0, 0)`, `(1256, 0)`, `(0, 708)`, and `(1256, 708)`.

The packaged scale test added 3 target-icon apps and 3 letter apps at both 100 and 150 percent
scaling. Each run reported `devicePixelRatio` 1 or 1.5, tile 80 by 96, plate 44 by 44, natural
icon size 48 by 48, and 3 icons plus 3 letters. Screenshots at
`C:\Users\Hi\AppData\Local\Temp\opencode\phase5-grid-1.png` and
`phase5-grid-1.5.png` were inspected and showed clean icons, labels, and letter plates.

## Owner-observed follow-up fixes

- **Rounded-corner fringe:** the App Grid card and bundle popover no longer draw a 1 px outer
  border. They use an inset ring (`box-shadow: inset 0 0 0 1px ...`) with
  `background-clip: padding-box`. Screenshots composited on white showed clean corners for both
  surfaces at 100 percent scaling.
- **UWP icons:** Start apps now carry `Square44x44Logo` from `AppxManifest.xml`. The scanner
  resolves `targetsize-48_altform-lightunplated`, `targetsize-48`, then larger scale variants
  and caches the PNG. Office 2016 Start-app duplicates are removed in favour of the classic
  shortcut with a real icon.
- **Classic fallback:** when a shortcut target has no icon, the scanner tries the shortcut's
  `IconLocation`. File Explorer and Python 3.14 Online Documentation now show their real icons.
- **Steam:** the scanner reads `libraryfolders.vdf` and `appmanifest_*.acf`, skips Steamworks
  Common Redistributables and Proton runtimes, and adds Deadlock, Drawful 2, Marvel Rivals, and
  Wallpaper Engine. Art from `appcache\librarycache\<appid>` is converted from JPEG to PNG;
  launch uses `steam://rungameid/<appid>`.
- **Editable title:** the header is an input backed by `grid.renameTitle`, persisted as an
  optional `title` in `grids.json`. The packaged check renamed `Apps` to `Focus`, preserved 73
  items, and restored `Focus` after restart.

## Icon and asset checks

The final packaged audit found 184 apps, 179 with an icon, and 5 without. All five remaining
letter tiles are stale shortcuts whose targets no longer exist: Android Studio, Docker Desktop,
Electron, Medal, and TLauncher. The packaged icon check loaded every non-null `iconUrl` and
found zero failures. The four Steam games all resolved library-cache art. The scale screenshots
and the grid/popover corner composites are in
`C:\Users\Hi\AppData\Local\Temp\opencode\`.

## Deviations from the written spec

- The App Grid and popover are static HTML/CSS/JS rather than React.
- The App Grid has a fixed 384 by 280 default size with internal scrolling; it does not grow
  with rows. The bundle popover does grow with rows, up to four, then scrolls.
- Pointer drag, merge, and reorder work in normal mode as well as edit mode.
- Hidden-name Start Menu entries are retained and flagged, so Show hidden entries has an
  effect.
- Icons come from shortcut targets or icon locations, packaged-app manifest assets, and Steam
  library-cache art. `iconUrl` is `null` when no usable icon exists.

These choices are recorded with alternatives in `docs/decisions.md`.

## Manual-only checks still pending

The automated suite does not launch real applications, trigger UAC, modify the real Start Menu,
or synthesize a physical outside click. These checklist items still need a manual pass:

- Clicking a normal tile launches the real app.
- Clicking a Steam game tile launches it through Steam.
- An app that requires administrator rights shows the normal Windows prompt.
- Renaming the App Grid title and restarting preserves the title; the packaged check covered
  this automatically, but the owner should confirm the interaction visually.
- Deleting a shortcut and clicking its still-visible tile shows the toast with Remove from grid.
  The watcher removes the tile within about 5 seconds, so click before the rescan for this
  check.
- Installing or uninstalling an app updates the picker within about 5 seconds.
- Clicking outside the popover on a physical display closes it after the 150 ms grace.
- Arrow-key focus, Enter to launch, and accessible tile names work with the real keyboard.
- A visual check of icons and letter tiles at 100 and 150 percent scaling on the target
  display.

Step 16, the experimental Hide desktop icons switch, was not implemented.

## Remaining acceptance items

- Complete the manual-only checks above.
- Owner review and approval of Phase 5.
- Phase 4's deferred live OpenAI-compatible, runtime prompt-injection, and owner-approval
  checks remain separate and do not block Phase 5 implementation.

No commit was made.
