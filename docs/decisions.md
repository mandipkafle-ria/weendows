# Decisions

## 2026-10-24 — React 19 instead of React 18

- **Phase:** 0
- **Context:** The current electron-vite React TypeScript scaffold installs React 19.3 and its
  matching types. The plan names React 18 in the stack table.
- **Decision:** Keep React 19.3 for v1.
- **Evidence:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and the packaged
  settings window all pass on Windows 10.0.26200 with React 19.3.
- **Alternatives considered:** Downgrading to React 18. It would add churn without a v1 feature
  that needs React 18.
- **Follow-up:** Re-check if a later phase needs a React 18-only library.

## 2026-10-24 — koffi 3.x native files must be unpacked with the optional package

- **Phase:** 0
- **Context:** koffi 3.3.3 loads its `.node` binary from the
  `@koromix/koffi-win32-x64` optional package, not from `node_modules/koffi` alone. An asar
  archive cannot load that native binary directly.
- **Decision:** Add both `node_modules/koffi/**` and `node_modules/@koromix/koffi-*/**` to
  `asarUnpack`.
- **Evidence:** The unpacked build at `dist/win-unpacked/HomeLayer.exe` returned
  `Progman handle: 0x101d0` from the Native check. The same check returned `0x101d0` in the
  non-packaged build.
- **Alternatives considered:** Unpacking only `node_modules/koffi/**`, as in the phase snippet.
  That omits the optional package that contains koffi 3.x's native addon.
- **Follow-up:** Re-test after any koffi major upgrade.

## 2026-10-24 — Keep electron-builder native rebuild disabled

- **Phase:** 0
- **Context:** koffi ships a prebuilt N-API addon for Windows x64. Building it from source on
  every package is unnecessary.
- **Decision:** Set `npmRebuild: false` in `electron-builder.yml`.
- **Evidence:** `npm run postinstall` and `npx electron-builder --win --dir` both completed; the
  packaged Native check passed.
- **Alternatives considered:** Letting electron-builder rebuild native dependencies. That adds
  build-tool requirements without a benefit for this app.
- **Follow-up:** Revisit if a later dependency needs an Electron-specific native rebuild.

## 2026-10-24 — Keep the plan's app ID until release work

- **Phase:** 0
- **Context:** Phase 0 needs a stable app user model ID, but the public product identity is not
  final.
- **Decision:** Use `com.yourname.homelayer` and product name `HomeLayer` for now.
- **Evidence:** The packaged settings window and tray use the ID and product name successfully.
- **Alternatives considered:** Choosing a final reverse-DNS ID now. That would require a domain
  decision before the release phase.
- **Follow-up:** Replace the placeholder app ID and finalize icons in Phase 8 before publishing.

## 2026-10-24 — Repository name is `weendows`

- **Phase:** 0
- **Context:** The owner supplied the public repository URL
  `https://github.com/mandipkafle-ria/weendows.git`. The plan's working name was `homelayer`.
- **Decision:** Use the supplied `weendows` repository as `origin`; keep `HomeLayer` as the
  product name in the app metadata.
- **Evidence:** `git push -u origin main` succeeded and GitHub Actions CI #1 passed on `main`.
- **Alternatives considered:** Creating a separate `homelayer` repository. Rejected because the
  owner already supplied the public repository.
- **Follow-up:** Keep the product name `HomeLayer` in installer and window metadata; the
  repository name is only the remote.

## 2026-10-24 — Phase 0 acceptance verification

- **Phase:** 0
- **Context:** Final Phase 0 verification on Windows 10.0.26200 x64 with Electron 44.9.3.
- **Decision:** Use the results below as the Phase 0 acceptance record.
- **Evidence:** `npm run typecheck`, `npm run lint`, `npm test` (2 files, 6 tests), `npm run build`
  and `npx electron-builder --win --dir` passed. The unpacked app returned
  `Progman handle: 0x101d0` and `Tick count: 367387859`. UI Automation found the `HomeLayer`
  tray icon in the notification overflow, with `Open settings` and `Quit` in its context menu.
  `app.quit()` exited with code 0. GitHub Actions CI #1 passed:
  https://github.com/mandipkafle-ria/weendows/actions/runs/40101123995.
- **Alternatives considered:** none.
- **Follow-up:** Await owner approval, then start Phase 1.

## 2026-10-24 - Phase 1 pinning strategy A

- **Phase:** 1
- **Context:** Three Win32 pinning strategies were implemented and tested on Windows
  10.0.26200 x64 with Electron 44.9.3.
- **Decision:** Use strategy A as the auto default: `SetWindowPos` with `HWND_BOTTOM` and
  `SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE`. Strategy A is the simplest call and passed
  every test-table row except lock and unlock, which still needs the owner's manual run.
- **Evidence:** Strategy A stayed above the wallpaper and desktop icons, stayed behind a
  maximized app, did not raise on click, did not steal focus on launch, stayed out of the
  taskbar and Alt+Tab, stayed visible after Win+D, survived an Explorer restart, and rendered
  correctly at 100, 125 and 150 percent scaling. Strategy B reported `ok: true` but the widget
  was invisible after minimizing windows. Strategy C was visible above the icons, stayed
  behind Notepad and survived Win+D, but was not tested as far as A.
- **Alternatives considered:** Strategy B failed the visible check. Strategy C works but is
  more fragile across Windows versions and has more mouse-input risk.
- **Follow-up:** Superseded on 2026-10-25 by the strategy B decision below. A failed the
  desktop visibility check on a later run.

## 2026-10-24 - Phase 1 widget memory per process

- **Phase:** 1
- **Context:** The phase must measure the cost of one clock widget so Phase 7 can decide how
  many widgets are safe. Measurements below are from the packaged
  `dist/win-unpacked/HomeLayer.exe` at 125 percent scaling, five seconds after creation.
- **Decision:** Use these measurements as the Phase 1 memory record.
- **Evidence:**

  | Widgets | Widget processes | Working set | Private bytes | Per-widget working set | Per-widget private bytes |
  | ------- | ---------------- | ----------- | ------------- | ---------------------- | ------------------------ |
  | 1       | 1                | 69.5 MB     | 23.6 MB       | 69.5 MB                | 23.6 MB                  |
  | 3       | 3                | 242.7 MB    | 71.3 MB       | 80.9 MB                | 23.8 MB                  |
  | 5       | 5                | 416.2 MB    | 118.1 MB      | 83.2 MB                | 23.6 MB                  |

  A single widget measured 70.1 MB working set and 23.7 MB private bytes at 100 percent, and
  70.8 MB working set and 23.6 MB private bytes at 150 percent. The first widget includes
  shared Chromium overhead; later widgets add roughly 81 to 83 MB working set each.

- **Alternatives considered:** none.
- **Follow-up:** Re-measure after the Phase 3 SDK and Phase 7 settings work, then set the
  default widget limit from the new numbers.

## 2026-10-24 - Phase 1 protocol keeps the standard widget scheme and enables CORS

- **Phase:** 1
- **Context:** The bundled DotGothic16 font failed to load from `widget://_fonts` with
  `Cross origin requests are only supported for protocol schemes: chrome, chrome-extension,
chrome-untrusted, data, http, https`. The widget document is sandboxed, so its security
  origin is opaque and the font request is cross-origin. Adding `corsEnabled: true` to the
  scheme privileges fixed the font fetch without weakening the CSP.
- **Decision:** Keep `widget` registered as a standard, secure, fetch-capable scheme and add
  `corsEnabled: true`. Keep the iframe sandbox at `allow-scripts` only and keep the CSP's
  `connect-src 'none'`.
- **Evidence:** In both the dev build and the packaged asar build, the widget loaded the font
  (`document.fonts.check('48px DotGothic16')` returned true), `window.parent.document` threw a
  cross-origin `SecurityError`, `fetch('https://example.com')` was blocked by `connect-src
'none'`, and `self.origin` and `window.origin` were `null`. Chromium 152 still serializes
  `location.origin` as `widget://clock` for a standard scheme even though the iframe has an
  opaque security origin. A non-standard scheme makes `location.origin` return `null` but
  also makes `window.isSecureContext` false and breaks relative URL resolution.
- **Alternatives considered:** Registering the scheme with `standard: false` satisfies the
  literal `location.origin` check but loses the secure context and relative URL support that
  later widgets need.
- **Follow-up:** If the literal `location.origin === 'null'` check is mandatory, revisit this
  decision before Phase 2. The current security behavior is opaque-origin sandboxing with
  parent access blocked and network access denied.

## 2026-10-25 - Phase 1 pinning default switches to strategy B

- **Phase:** 1
- **Context:** The first Phase 1 runs recorded strategy A as the default. A fresh packaged run
  showed the clock window at `48,48` with `IsWindowVisible` true, but it disappeared when
  Win+D showed the desktop or when the covering window was closed. A pins with
  `HWND_BOTTOM`; on Windows 10.0.26200 the shell raises the desktop above a bottom-most
  window, so the widget ends up behind the wallpaper even though the pin call returns true.
- **Decision:** Use strategy B as the auto default. B re-pins the widget directly above
  Progman, and the 2-second maintenance timer restores it after the desktop is raised. Keep
  A and C available through `HL_PIN_STRATEGY` for diagnostics.
- **Evidence:** With B, the widget stayed visible at `48,48` through two automated Win+D
  cycles on Windows 10.0.26200 x64 at 125 percent scaling. A direct overlap check moved the
  widget over the desktop icons; it covered them, so it is above the icon layer. With A, the
  same desktop check left the desktop empty. Strategy C still fails to reparent:
  `SetParent` to Progman does not stick (`getParent` does not return the host), so C needs
  window-style work before it can be a fallback. The packaged app was rebuilt after the
  default change and `npm run phase1` now launches with `strategy=auto`.
- **Alternatives considered:** Keep A and add a z-order listener. A would still be below the
  desktop when Win+D runs. Fix C now. That adds cross-process window-style handling and is
  more fragile than B, which already passes the visible and Win+D rows.
- **Follow-up:** Run the full Phase 1 table with `npm run phase1` (auto = B), including the
  lock/unlock and Explorer restart rows, and record the results before Phase 1 approval.

## 2026-10-25 - Preloads must be isolated bundles for sandboxed windows

- **Phase:** 2
- **Context:** Both Phase 2 preloads import the shared `IPC` map. The default electron-vite
  build split that map into `out/preload/chunks/ipc-*.js` and emitted
  `require("./chunks/ipc-*.js")` in both preloads. Sandboxed Electron preloads only support a
  limited `require` and cannot load relative chunks. The packaged Settings window showed a
  blank page because `window.api` was undefined, and every widget shell showed its
  "Widget bridge unavailable" error.
- **Decision:** Set `preload.build.isolatedEntries: true` and
  `preload.build.externalizeDeps: false` so each preload is standalone. Keep `sandbox: true`
  on the Settings and widget windows.
- **Evidence:** The broken packaged build logged
  `Unable to load preload script ... module not found: ./chunks/ipc-*.js`. After the config
  change, `out/preload` contained only `settings-preload.js` and `shell-preload.js`.
  `window.api` and `window.shellApi` were present, Settings rendered its gallery, and the
  clock widget rendered in the packaged app.
- **Alternatives considered:** Disabling sandboxing for the preloads, or duplicating the IPC
  strings in each preload. Both weaken the security model or add drift. Isolated bundles keep
  one shared source of truth and preserve sandboxing.
- **Follow-up:** Re-check preload output after adding any third-party preload dependency.

## 2026-10-25 - First-run seeding only for missing or corrupt layouts

- **Phase:** 2
- **Context:** Seeding a default clock whenever the layout has zero placements would make it
  impossible to keep an intentionally empty desktop. A valid empty layout is different from a
  first run or a recovered corrupt file.
- **Decision:** Seed the default clock only when `layout.json` was missing or was recovered
  from corruption **and** there are no placements. A valid `{ "schema": 1, "placements": [] }`
  stays empty.
- **Evidence:** With a valid empty layout the Settings list showed "No widgets yet" and the
  file stayed empty after startup. Deleting the file produced one Clock at `48,48`. Garbage
  content produced a `layout.json.corrupt-<timestamp>` backup and one default Clock.
- **Alternatives considered:** Seeding whenever the list is empty. Rejected because users need
  to be able to remove every widget.
- **Follow-up:** Keep this behavior when AI widgets add hide/delete lifecycle states.

## 2026-10-25 - Missing displays fall back without overwriting saved placements

- **Phase:** 2
- **Context:** A monitor can be unplugged or disabled after a layout is saved. The plan
  requires widgets to appear inside the primary work area but not to lose their saved
  display/position until the user moves them.
- **Decision:** Resolve a placement to its display by string id, fall back to the primary
  display when it is missing, and clamp the window bounds for display only. Do not write the
  fallback back to `layout.json` during restore. Persist a new display id and position only
  when a drag or resize ends.
- **Evidence:** Replacing a placement's `displayId` with `999999999` and its `x`/`y` with
  `5000` placed the packaged window at `1488,816` (48 DIP visible) on the primary display,
  while `layout.json` still contained the original `displayId`, `5000` and `5000`.
- **Alternatives considered:** Clamping and saving on every startup. That would destroy the
  saved multi-monitor layout whenever a monitor is temporarily absent.
- **Follow-up:** Run the physical unplug/replug row in the last phase (Phase 8) before release.
  The owner moved it there on 2026-10-25 because no second monitor is available now.

## 2026-10-25 - Physical monitor test moves to the final phase

- **Phase:** 2 → 8
- **Context:** The only remaining Phase 2 row is the physical second-monitor unplug/replug test.
  No second monitor is available on the current machine, and the owner asked to proceed with
  Phase 3 instead of blocking on hardware.
- **Decision:** Move that row to Phase 8 and keep it open there. Phase 2 is otherwise approved;
  the row is not marked PASS.
- **Evidence:** Phase 2 results record `MOVED` for the row. The simulated missing-display test
  remains the only automated coverage until Phase 8.
- **Alternatives considered:** Marking the row PASS from the simulated test. Rejected because the
  plan explicitly says the simulation does not replace the physical unplug/replug test.
- **Follow-up:** Run and record the row during Phase 8 clean-machine and release-candidate
  testing.

## 2026-10-25 - Frozen widgets use a MessagePort heartbeat

- **Phase:** 3
- **Context:** A sandboxed widget iframe can freeze while the widget shell stays responsive.
  Electron's `BrowserWindow` `unresponsive` event did not fire for `while(true) {}` inside the
  iframe, so the Phase 3 security test showed no badge after 45 seconds.
- **Decision:** Add a shell-to-SDK heartbeat. The shell sends `hl-ping` every 4 seconds and
  marks the widget unresponsive after 12 seconds without `hl-pong`. It reports through the
  shell IPC channel, and `LayoutService` shows the existing Reload/Disable badge. Reload
  destroys and recreates the widget window; three failures in one minute disable the widget.
- **Evidence:** The security script
  `scripts/phase-3-security.mjs` observed `Widget not responding` with Reload and Disable
  while the System widget kept updating. Reload restored the probe widget, and Disable removed
  it. A separate three-freeze run disabled Clock after the third report. Direct
  `webContents.reload()` left the shell loading forever with the frozen child frame, so Reload
  now destroys and recreates the `BrowserWindow`.
- **Alternatives considered:** Relying only on the `BrowserWindow` unresponsive event failed.
  Reloading the existing `webContents` did not recover the frozen iframe. A per-widget process
  kill switch is deferred until Phase 7 memory work.
- **Follow-up:** Re-check the heartbeat when Phase 4 adds generated widgets, and re-measure the
  extra IPC traffic during Phase 7.

## 2026-10-25 - Interactive widgets opt into keyboard focus

- **Phase:** 3
- **Context:** Widget windows were created with `focusable: false` so they would not steal focus
  from other apps. Automated tests typed into Notes and Weather through Playwright's CDP input,
  which masked the problem: a non-focusable window keeps `document.hasFocus()` false, so real
  keyboard input never reaches the widget.
- **Decision:** Add an optional `focusable` flag to widget manifests and built-in definitions.
  Notes and Weather set it to `true`; all other built-ins default to `false`. Focusable widgets
  still use `showInactive()` and are re-pinned to the desktop on `focus` and `blur`, so clicking
  one does not leave it raised above normal windows.
- **Evidence:** With the flag, `BrowserWindow.isFocusable()` and `webContents.isFocused()` are
  true for Notes; focusing the text area makes `document.hasFocus()` true and Playwright can
  type into it. Without the flag, `win.focus()` and `webContents.focus()` are no-ops and the
  page never has focus. Win32 extended styles confirm that Notes has `WS_EX_TOOLWINDOW` and no
  `WS_EX_APPWINDOW` (still hidden from Alt+Tab and the taskbar), while System retains
  `WS_EX_NOACTIVATE`.
- **Alternatives considered:** Making every widget focusable (simple, but clicking Clock,
  System, or Battery could steal keyboard focus), and focus-on-demand through new shell/SDK
  plumbing (more complex, and it would add API surface not in the Phase 3 spec).
- **Follow-up:** When Phase 4 adds generated widgets, include the manifest flag in the
  generation prompt so interactive generated widgets can request focus.

## 2026-10-25 - openLink approval is cached per widget

- **Phase:** 3
- **Context:** `hl.openLink` must ask before opening a browser. The Phase 3 spec says the prompt
  is shown once per widget and names the first host, then the approval is remembered.
- **Decision:** Cache approval in memory per widget, not per host. After the first approved
  call, a different host opens without another prompt. Denial is not cached; the next call
  prompts again. Every call still passes the 3-second rate limit and URL validation.
- **Evidence:** The packaged security run prompted once for `example.com`, opened it, rejected
  an immediate second call with `rate_limited`, and after 3 seconds opened `example.org`
  without a second prompt. A cancelled prompt returned `permission_denied`; a widget without
  the permission also returned `permission_denied` without prompting.
- **Alternatives considered:** Prompting per host is stricter but adds prompt fatigue and is not
  what the Phase 3 spec requires. Caching denial would prevent a widget from recovering after a
  user changes their mind.
- **Follow-up:** Revisit per-host approval if generated widgets make broader link-opening common,
  and add a Settings control before enabling arbitrary generated widgets in Phase 4.

## 2026-10-25 - Phase 3 approved

- **Phase:** 3
- **Decision:** Owner approved Phase 3 after every security-table row and the added openLink
  checks passed on the packaged app.
- **Evidence:** `docs/phase-3-security-results.md`; packaged security suite all PASS; Vitest
  8 files / 74 tests; lint and typecheck pass.
- **Follow-up:** Start Phase 4 after choosing a test AI provider. A real provider reply is
  required for the Phase 4 acceptance checklist.

## 2026-10-25 - AI key decryption stays in the AI service

- **Phase:** 4
- **Context:** The Phase 4 spec says to decrypt the stored provider key only inside
  `ai-service.ts` at call time. The initial implementation decrypted inside
  `SecretsService.getKey`.
- **Decision:** `SecretsService` now exposes only the encrypted value. `AiService` performs the
  `safeStorage.decryptString` call immediately before constructing a provider request. The
  renderer still receives only `hasKey`.
- **Evidence:** A packaged run saved a local OpenAI-compatible key, confirmed that
  `secrets.json` contained no plaintext, and observed the decrypted key only in the provider
  request's `Authorization` header. Remove key deleted the entry.
- **Alternatives considered:** Keeping decryption in `SecretsService` would have been simpler,
  but it would not match the spec's literal boundary.
- **Follow-up:** Keep key decryption out of shared and renderer code.

## 2026-10-25 - Generated widgets drop hosts when network permission is unchecked

- **Phase:** 4
- **Context:** The approval dialog lets the user uncheck individual permissions and hosts. A
  widget could request `network` and an allowed host, but the user could uncheck `network`
  while leaving the host checked.
- **Decision:** Saving filters approved hosts against both the manifest's requested
  permissions and the user's approved permissions. If `network` is not approved, no hosts are
  saved.
- **Evidence:** The approval save path uses the same filtering for new and revised widgets.
  The real Gemini save produced a manifest containing only the approved permissions, and the
  repair run produced a network widget with matching permission and host.
- **Alternatives considered:** Saving hosts without the permission would leave a misleading
  manifest and rely on the runtime permission check alone.
- **Follow-up:** Keep the approval UI and manifest filtering aligned if more permissions are
  added.

## 2026-10-25 - Phase 4 real Gemini acceptance used the lite model

- **Phase:** 4
- **Context:** The saved Gemini key worked for listing models and generating widgets, but
  `gemini-3.8-flash` exceeded the required 60-second timeout. `gemini-3.5-flash-lite`
  completed the generation, edit, and undo checks.
- **Decision:** Keep the 60-second timeout from the spec and use a faster Gemini model for
  acceptance. Do not raise the timeout just to accommodate a slower model.
- **Evidence:** `docs/phase-4-ai-results.md`; real generation produced `Dotted Stats` with
  `system.stats` and `system.battery`; edit preserved name, size, and permissions; Undo restored
  the original HTML byte-for-byte.
- **Alternatives considered:** Increasing the timeout would change the specified failure
  behavior and make cancellation tests less meaningful.
- **Follow-up:** Re-test the default model choice when Gemini model availability changes, and
  complete the live OpenAI-compatible and prompt-injection checks before Phase 4 approval.

## 2026-10-25 - Transparent widget canvases never use document color-scheme

- **Phase:** 4
- **Context:** A rounded AI widget showed white square corners on the desktop. The widget HTML
  had a transparent `html`/`body`, but the widget shell set `color-scheme: dark`. In a
  transparent Electron window, that caused the embedded frame to paint an opaque white canvas.
  Widgets that set their own document color scheme painted an opaque dark canvas.
- **Decision:** Remove `color-scheme` from the widget shell. The widget protocol strips legacy
  `color-scheme` meta tags and injects `html, body, :root { background: transparent !important;
color-scheme: normal !important; }`. Widgets may opt into dark native controls by setting
  `color-scheme: dark` on individual controls. Remove document-level color schemes from the
  built-in widgets.
- **Evidence:** A packaged legacy widget containing both a dark `color-scheme` meta tag and
  `:root` rule had transparent corners after the change. The built-in Clock rendered a
  transparent rounded card with only its shadow outside the radius. `npm test` passes 10 files
  / 105 tests.
- **Alternatives considered:** Clipping the iframe to a fixed radius would hide some corner
  artifacts but would not fix the opaque canvas behind translucent cards and would clip widgets
  with different radii.
- **Follow-up:** Keep document-level `color-scheme` out of widget HTML and the widget shell.

## 2026-10-25 - AI widgets enforce a readable minimum size

- **Phase:** 4
- **Context:** AI widgets were saved with a fixed 120 by 80 minimum. A larger widget could be
  shrunk until its layout became unreadable. The generated HTML has no reliable way to signal
  its own readable minimum.
- **Decision:** Add `minWidth` and `minHeight` to the AI manifest. The prompt asks the model for
  the smallest readable size, at least 75 percent of the design width and height and higher for
  dense layouts. The parser normalizes the values: missing values become 75 percent, lower
  values are raised, larger values are kept, and values above the design size are clamped. The
  resize path, initial sizing, and AI edit path enforce the stored limits.
- **Evidence:** `npm test` passes 10 files / 105 tests, including parser normalization and the
  shared minimum-size helper. `npm run typecheck` and `npm run lint` pass. A packaged run
  resized a 240 by 240 widget toward 40 by 40 and stopped at 184 by 184, the nearest snap above
  the 180 by 180 minimum; a legacy 120 by 120 minimum produced the same result.
- **Alternatives considered:** A fixed minimum would still allow unreadable large widgets. Only
  a prompt rule would be advisory and could be ignored by a model.
- **Follow-up:** Keep the 75 percent floor and prompt rule aligned if the generator design
  changes.

## 2026-10-26 - App Grid and bundle popover use static trusted HTML

- **Phase:** 5
- **Context:** The Phase 5 spec describes the App Grid as a React page. The other trusted
  built-in widgets are static HTML loaded directly from `resources/builtin-widgets`, and the
  App Grid runs inside the existing sandboxed widget shell.
- **Decision:** Build the App Grid and bundle popover as static HTML/CSS/JS pages that use the
  widget SDK. Do not add a second React build path for trusted built-ins. AI-generated widgets
  remain a separate, sandboxed code path.
- **Evidence:** `resources/builtin-widgets/app-grid/index.html` and `popover.html` load through
  `widget://`; the packaged smoke suite passed 24 checks, including picker, drag, popover,
  persistence, and 60-app scrolling. `npm run build:unpack` and all 138 Vitest tests pass.
- **Alternatives considered:** A React entry would add another preload/renderer bundle and a
  second way to ship trusted code without improving the small tile UI.
- **Follow-up:** Keep trusted built-ins static and keep AI widget code out of
  `resources/builtin-widgets`.

## 2026-10-26 - App Grid disables the edit overlay for tile input

- **Phase:** 5
- **Context:** The widget shell's edit overlay normally covers the whole widget to handle
  placement and resize. That overlay would intercept clicks and pointer drags on the App Grid
  tiles, making bundles impossible to use in edit mode.
- **Decision:** Add `editPassthrough` to the built-in manifest. For that widget the shell
  overlay uses `pointer-events: none`; the `.overlay-drag` strip, toolbar, and resize handle
  keep pointer events. Tile drag, merge, launch, and picker input therefore reach the widget.
- **Evidence:** Packaged checks create and merge bundles while the widget is in edit mode, and
  normal-mode launch and reorder also pass. The shell still moves and resizes the widget through
  the explicit drag handle and resize handle.
- **Alternatives considered:** Raising tile z-index or special-casing pointer targets in the
  shell would duplicate hit testing and make future built-ins fragile.
- **Follow-up:** Reuse `editPassthrough` only for dense interactive built-ins that need direct
  pointer input.

## 2026-10-26 - App Grid keeps a fixed height and scrolls

- **Phase:** 5
- **Context:** The spec says the grid height grows with rows up to a maximum. Desktop widget
  placement and resize math assumes a stable rectangle, and a growing widget would move
  neighboring widgets or require a layout reflow.
- **Decision:** Keep the App Grid at its default 384 by 280 DIP, with a 320 by 180 minimum, and
  scroll the tile area inside it. The bundle popover is different: its height is computed from
  the number of rows, up to four, and then scrolls.
- **Evidence:** With 60 apps the packaged grid reported `clientHeight` 213 and `scrollHeight`
  2584, and all 72 tiles rendered. Screenshots at 100 and 150 percent scaling show a stable
  384 by 280 card with 80 by 96 tiles.
- **Alternatives considered:** Auto-growing the window would better match the sketch but makes
  placement, overlap, and resize behavior less predictable.
- **Follow-up:** Consider optional pages or an auto-grow mode in a later phase, after measuring
  how it interacts with layout persistence.

## 2026-10-26 - App Grid allows drag outside edit mode

- **Phase:** 5
- **Context:** The spec says bundle creation starts with a drag in edit mode. The product goal
  is an iPhone-like grid, where rearranging and merging normally happens directly on the home
  screen.
- **Decision:** Accept tile pointer drags in normal mode as well as edit mode. Edit mode is
  still the only mode for moving or resizing the widget itself. A drag starts after 8 DIP and
  a merge target requires 500 ms over the middle of another tile.
- **Evidence:** The packaged smoke suite creates a bundle, adds to an existing bundle, and
  reorders bundle apps without entering edit mode. Edit-mode placement and resize checks still
  pass.
- **Alternatives considered:** Restricting all drag to edit mode is closer to the literal spec
  but makes the primary bundle interaction feel unlike a phone home screen.
- **Follow-up:** If accidental merges become a problem, add a short undo action rather than
  removing normal-mode dragging.

## 2026-10-26 - Hidden Start Menu entries stay available in the picker

- **Phase:** 5
- **Context:** The spec says to skip names that look like uninstallers, readmes, help, licenses,
  or websites, but also requires a Show hidden entries switch. Discarding those entries would
  make the switch unable to reveal anything.
- **Decision:** Keep every parsed shortcut and mark heuristic matches as `hidden`. The default
  picker filters them out; Show hidden entries reveals them. UWP entries are not hidden by
  this heuristic.
- **Evidence:** The packaged scan reported 184 apps and the picker showed 167 visible rows
  before enabling hidden entries. The scanner unit tests cover the name heuristic and
  de-duplication preference for visible entries.
- **Alternatives considered:** Dropping hidden entries entirely would simplify the scanner but
  remove the documented escape hatch for false positives.
- **Follow-up:** Tune `HIDDEN_APP_NAME_RE` if legitimate apps are repeatedly hidden.

## 2026-10-26 - App icons come from targets, manifests, and Steam cache

- **Phase:** 5
- **Context:** Reading an icon from a `.lnk` path can include the shortcut arrow overlay, and a
  shortcut can outlive its target. UWP apps do not expose a shortcut target at all, and Steam
  library art is stored as a JPEG in a hash-named cache directory. Advertising an icon URL for
  a missing or unreadable file produces console 404s and hides the letter fallback.
- **Decision:** For classic shortcuts, use `app.getFileIcon` on the target and then the
  shortcut's `IconLocation` as a fallback. For UWP Start apps, read `Square44x44Logo` from
  `AppxManifest.xml` and resolve the preferred `targetsize-48`/light-unplated variant. For
  Steam, select a square 32 px image from `appcache\librarycache\<appid>` and convert it to PNG
  through `nativeImage`. Cache metadata as `{mtimeMs, source}`, delete stale PNG/meta files when
  extraction fails, and set `iconUrl` to `null` whenever no PNG is available. Collapse a Start
  app that duplicates a visible classic shortcut by name in favour of the classic entry.
- **Evidence:** The final packaged audit found 184 apps, 179 with icons, and 5 without. All five
  remaining letters are stale shortcuts whose targets no longer exist: Android Studio, Docker
  Desktop, Electron, Medal, and TLauncher. File Explorer and Python 3.14 Online Documentation
  now show their fallback icons, and all four Steam games have cache art. The packaged icon
  check found zero failing `hl-icon` loads. Scaling screenshots at 100 and 150 percent show
  clean icons and letter plates.
- **Alternatives considered:** Using the `.lnk` path risks the shortcut arrow. Keeping a
  non-null URL and relying on the image error handler leaves avoidable 404s in the console.
  Launching a Start app just to discover its icon would be slower and less predictable.
- **Follow-up:** Stale shortcuts still render letters until the user removes them or fixes the
  shortcut. Consider jumbo icons through `IShellItemImageFactory` only if 32/48 px icons are
  not good enough at high scaling.

## 2026-10-26 - App Grid launches only scanner-owned ids

- **Phase:** 5
- **Context:** A renderer must never be able to launch an arbitrary executable by supplying a
  path. The App Grid and popover both run in the sandboxed widget session.
- **Decision:** The renderer sends only an app id. Main validates the id against its scanner
  list, launches classic apps through `shell.openPath` on the stored `.lnk`, launches UWP apps
  through `explorer.exe shell:AppsFolder\<AppID>`, and launches Steam games through
  `steam://rungameid/<appid>`. A path or unknown id is rejected before any process starts.
- **Evidence:** The packaged smoke check sent `C:\Windows\notepad.exe` and a fake id. The path
  returned `invalid_args` with `appId must be an app id, not a path`; the fake id returned
  `not_found` with `app is not in the scanner list`; nothing launched. Unit tests cover the
  Steam URL and malformed-id rejection.
- **Alternatives considered:** Accepting a path would make the renderer a general process
  launcher and bypass the scanner's trust boundary.
- **Follow-up:** Keep all future App Grid mutations id-only and revalidate ids in main.

## 2026-10-26 - Removing from a bundle returns the app to the grid

- **Phase:** 5
- **Context:** The spec says Remove from bundle puts the app back on the grid and a bundle with
  one app dissolves. The first implementation removed the app from the bundle record but did
  not add a standalone grid item.
- **Decision:** When an app is removed from a bundle, insert it as a standalone item next to
  the bundle. If one app remains, dissolve the bundle and insert that app as standalone. An
  empty bundle is deleted. The popover closes after a dissolve.
- **Evidence:** The packaged smoke check removed one app from a three-app bundle and observed
  two apps remaining plus the removed app back on the grid. Removing from a two-app bundle
  dissolved it, closed the popover, and increased standalone tiles from 9 to 11.
- **Alternatives considered:** Leaving the removed app only in persisted state would make it
  unreachable and would lose the user's app.
- **Follow-up:** Keep the model and popover tests aligned if bundle removal rules change.

## 2026-10-26 - App Grid memory measured with 60 apps

- **Phase:** 5
- **Context:** The Phase 5 acceptance checklist requires measuring the grid window with about
  60 apps and recording the result.
- **Decision:** Measure renderer working sets through `app.getAppMetrics()` in the packaged
  60-app smoke run at 125 percent scaling. No hard memory budget is set for v1.
- **Evidence:** The latest run reported 188 MB total across the two widget-shell renderer
  processes: approximately 103 MB for the App Grid and 85 MB for the Clock. The grid held 72
  tiles, `clientHeight` 213, and `scrollHeight` 2584. Previous runs reported 185 and 186 MB.
- **Alternatives considered:** A fixed budget would be premature without a baseline across
  more machines and GPU configurations.
- **Follow-up:** Re-measure with 100+ apps or optional pages, and investigate if the App Grid
  working set grows materially.

## 2026-10-26 - Steam games come from app manifests, not Start Menu shortcuts

- **Phase:** 5
- **Context:** Steam does not create Start Menu shortcuts for most installed games, so the
  scanner only found the Steam client. The library still records installed games in
  `steamapps\appmanifest_*.acf` files and keeps art in `appcache\librarycache`.
- **Decision:** Discover the standard Steam roots, follow `libraryfolders.vdf` to additional
  libraries, and parse each appmanifest for `appid` and `name`. Skip Steamworks Common
  Redistributables and Proton runtimes, deduplicate by app id, and expose games with
  `kind: 'steam'`. Launch through `steam://rungameid/<appid>`.
- **Evidence:** The packaged scan added Deadlock, Drawful 2, Marvel Rivals, and Wallpaper
  Engine, all with library-cache icons. The redistributable manifest was skipped. Unit tests
  cover VDF parsing, duplicate app ids, skipped redistributables, icon selection, and the Steam
  launch URL.
- **Alternatives considered:** Scanning only Start Menu shortcuts misses games. Scraping the
  Steam client UI or requiring the Steam Web API would add authentication and network
  dependencies for local data that is already on disk.
- **Follow-up:** Add a registry-based Steam path lookup if users report custom install roots
  outside the standard Program Files and LocalAppData locations.

## 2026-10-26 - App Grid title is editable and persisted per widget

- **Phase:** 5
- **Context:** The header always said "Apps", so users could not distinguish multiple App Grid
  widgets or name a grid after its purpose.
- **Decision:** Store an optional `title` on each grid record in `grids.json`, expose it on
  `AppGridState`, and add `grid.renameTitle` to the widget API/SDK. The header input trims to
  32 characters and saves on Enter or blur; Escape restores the last saved title.
- **Evidence:** The packaged check renamed `Apps` to `Focus`, preserved 73 items, wrote the
  title to `grids.json`, and restored `Focus` after a full restart. Unit tests cover trimming,
  empty-title rejection, item preservation, and persistence.
- **Alternatives considered:** A global title would not distinguish multiple grids. A separate
  settings field would add friction for a frequently changed label.
- **Follow-up:** If per-grid icons or colors are added, keep them on the same record.

## 2026-10-26 - Cards use an inset ring instead of an outer border

- **Phase:** 5
- **Context:** A 1 px semi-transparent outer border produced a visible light fringe around the
  rounded corners when the transparent widget was composited on a white background.
- **Decision:** Remove the outer border from the App Grid card and bundle popover, set
  `background-clip: padding-box`, and draw the edge with an inset `box-shadow` ring. Keep the
  existing drop shadow.
- **Evidence:** Screenshots of both surfaces composited on white showed clean rounded corners
  with no light fringe. The scale screenshots at 100 and 150 percent still show the intended
  edge treatment.
- **Alternatives considered:** Keeping the border and clipping with `overflow: hidden` still
  leaves anti-aliased edge pixels outside the radius. A solid background would lose the
  translucent glass effect.
- **Follow-up:** Recheck the corners on light wallpapers after any card-radius or shadow change.

## 2026-10-26 - Saved AI widgets stay in the local widget directory

- **Phase:** 4 follow-up
- **Context:** Removing an AI widget from the desktop deleted its directory because removal
  treated every non-built-in widget as disposable. Users could not recover a generated widget
  after dismissing it.
- **Decision:** Keep AI widget files under `%APPDATA%\HomeLayer\widgets\<id>\`. Removing a
  widget now deletes only its placement. Settings lists unplaced `kind: "ai"` manifests under
  **AI generated**. **Add copy** duplicates the saved directory and places the copy, leaving
  the source available. **Delete** is a separate, explicitly confirmed permanent action.
- **Evidence:** Unit tests cover preserving the files on removal, copying without consuming the
  source, and permanent deletion. The full suite passes with 16 files / 141 tests, and the
  production build passes. A packaged Playwright check passed 6/6: the saved widget was listed,
  Add copy created a separate persisted id and files, the source stayed saved, Remove kept the
  copy's files, and Delete removed only the selected widget.
- **Alternatives considered:** SQLite adds migration and recovery surface without improving
  lookup for a small number of local folders. Re-adding the same widget id would prevent a
  second desktop instance and make edits affect the saved original.
- **Follow-up:** Owner review remains.

## 2026-10-26 - Wallpaper imports are copied and validated inside the library

- **Phase:** 6A
- **Context:** Static wallpapers need stable local paths for Windows, thumbnails, and
  slideshow changes, while user-selected source files must not be moved or modified.
- **Decision:** Copy every image, video, and HTML folder into
  `%APPDATA%\HomeLayer\wallpapers\<id>\`. Validate every path before a registry or native
  call: absolute, existing, allowed extension, and contained inside the wallpaper library.
  Serve thumbnails through the privileged `hl-wallpaper://thumb/<id>` scheme instead of
  exposing filesystem paths to the Settings renderer.
- **Evidence:** The packaged smoke imported two images, one MP4, and one HTML folder; all
  thumbnails loaded, the applied path stayed under the temporary library, and SHA-256 hashes
  of all source fixtures were unchanged before and after. Unit tests cover relative, outside,
  missing, unsupported, video-as-static, and HTML-folder paths.
- **Alternatives considered:** Referencing source paths directly would break when users move
  or delete them. Moving originals would be destructive. A generic `file://` renderer URL
  would weaken path containment.
- **Follow-up:** Phase 6B can reuse the copied files and video poster for live playback.

## 2026-10-26 - Slideshow uses a persisted chained timer and restores the original fit

- **Phase:** 6A
- **Context:** A slideshow must survive restart and sleep, and Restore must return the
  first-run desktop rather than only its image path.
- **Decision:** Use chained `setTimeout` calls, persist `lastChangeAt` and the image list in
  `wallpapers.json`, and recompute on `resume` and `unlock-screen`. Capture the first-run
  `WallpaperStyle` and `TileWallpaper` alongside `WallPaper`, and write all three when
  restoring. Optional shuffle never picks the current image.
- **Evidence:** The packaged smoke ran all six fit modes, persisted a 1-minute slideshow,
  restarted the app with `lastChangeAt` two minutes in the past, observed an immediate
  advance to the next image, and restored the original path/style/tile. Vitest covers the fit
  table and scheduling with fake timers, including chained intervals, daily intervals,
  long-sleep recomputation, stop behavior, order, and shuffle.
- **Alternatives considered:** `setInterval` drifts and cannot cheaply recompute after sleep.
  Restoring only the path leaves HomeLayer's last fit mode applied to the original wallpaper.
- **Follow-up:** Owner visual and real sleep/resume checks remain; Phase 6B adds live
  playback and pause-on-fullscreen/battery behavior.

## 2026-10-26 - Phase 6B spike selects the Progman-child desktop layer

- **Phase:** 6B spike
- **Context:** Windows 11 25H2 build 10.0.26200.9711 is the owner's current build. The live
  wallpaper layer must be proven before production code is written, and Explorer's desktop
  layout differs between Windows builds.
- **Decision:** Use the `progman-child` strategy on this build. Keep `HL_WP_STRATEGY`
  selectable (`auto`, `classic`, `progman-child`) in `scripts/spike-wallpaper.ts`; auto
  detection checks for `SHELLDLL_DefView` under Progman first, then the classic WorkerW
  layout. Send `0x052C` with `wParam=0xD` and `lParam=0x1` before detecting the layout.
  Insert the spike window immediately after `SHELLDLL_DefView` with `SetWindowPos` using
  `DefView` as `hWndInsertAfter`; do not use `HWND_BOTTOM`, which places it below
  `WorkerW` and hides it behind the wallpaper. Do not call
  `win.setIgnoreMouseEvents(true)` on the attached child: it adds `WS_EX_LAYERED` and
  `WS_EX_TRANSPARENT` (`0x8280120`) and makes the layer composite over running apps.
- **Evidence:** The standalone Electron spike ran at 125 percent scaling on a single
  1536x864 DIP display, targeting a 1920x1080 physical rectangle. `0x052C` returned 1 and
  did not need the `0/0` fallback. Auto chose `progman-child`; `SHELLDLL_DefView` was a
  child of Progman (`0x101c0`). With the corrected insert order, the child z-order became
  `SHELLDLL_DefView`, spike, `WorkerW` (`windowChildIndex=1`, `defViewChildIndex=0`). The
  window style changed from `0x4c00000` to `0x44c00000` (child set, popup cleared), the
  extended style stayed `0x8200100` (no layered/transparent bits), `SetParent` stuck, the
  window was visible at `1920x1080`, and `Shell_TrayWnd` remained visible. With the spike
  active, the foreground IDE remained visible and Win+D showed the magenta layer on the
  desktop. The earlier `setIgnoreMouseEvents(true)` attempt produced a full-screen dark
  gray layer over apps; removing it and inserting above `WorkerW` fixed both symptoms. The
  spike exited cleanly; the existing development Electron process was not touched. Results
  are in `out/spike-wallpaper-result.json` and `out/spike-wallpaper.log`.
- **Alternatives considered:** Forcing `classic` was not possible on this layout because
  `SHELLDLL_DefView` is already under Progman. The classic WorkerW branch remains in the
  spike for Windows 10 and other builds, but it was not exercised here. `HWND_BOTTOM` and
  Electron `setIgnoreMouseEvents` were rejected because they hide the layer behind the
  wallpaper or composite it over apps, respectively.
- **Follow-up:** Owner confirmed the full spike checklist passes on 2026-10-26; the working
  strategy is `progman-child`. Phase 6B implementation may proceed. Note that this machine
  normally has desktop icons hidden (`HideIcons=1`), so icon checks require enabling them
  temporarily.

## 2026-10-27 - Live wallpapers use a sandboxed per-display host with a static fallback

- **Phase:** 6B
- **Context:** Video and HTML wallpapers must render behind the icons without covering apps,
  survive Explorer and display changes, pause when the user needs the GPU, and leave a usable
  desktop if HomeLayer exits unexpectedly.
- **Decision:** Create one attached child window per display from
  `wallpaper-window.ts`. Reuse the existing widget session partition and `widget://wp-<id>`
  mapping for HTML wallpapers, and serve video through
  `hl-wallpaper://media/<id>/<filename>` with explicit byte-range handling. Use
  `wallpaper-live.ts` to own attach, pause, recovery, display rebuilds, mouse forwarding, and
  fallback. Do not call `setIgnoreMouseEvents(true)`; the proven spike showed that it makes the
  child composite over applications. Interactive HTML forwards normalized mouse coordinates
  and mouse movement only; click forwarding remains out of scope for v1. Apply the video poster,
  original Windows wallpaper, or first library image before attaching so a killed process
  leaves a static desktop.
- **Evidence:** The spike established the `progman-child` attach and z-order. The automated
  gates cover strategy selection, pause policy, media URL/range parsing, path containment, and
  HTML wallpaper host mapping. The packaged build contains the host page and wallpaper preload.
  Manual desktop, Explorer restart, monitor, lock/suspend, fullscreen pause, and kill-app checks
  remain in `docs/phase-6b-manual-test.md`.
- **Alternatives considered:** A single virtual-desktop-sized window would not map correctly
  across mixed scaling and monitor changes. Using the default session would bypass the existing
  widget network block. `setIgnoreMouseEvents` was rejected because it changes the extended
  window style and breaks the layer. Relying on Windows to restore a static wallpaper after a
  crash was rejected because it leaves black until the app restarts.
- **Follow-up:** Complete the manual checklist and test matrix before marking Phase 6B complete.

## 2026-10-27 - Phase 7 settings are a persisted tab shell with renderer i18n

- **Phase:** 7
- **Context:** Phase 7 needs six Settings tabs, remembered window size, run-at-login, a
  configurable hotkey, theme selection, onboarding, and translatable text without duplicating
  state in each panel.
- **Decision:** Keep one `AppSettingsService` for app-level settings (`settings.json`) and one
  `SettingsWindow` size persistence path. Load settings before services start and pass the
  effective theme to `nativeTheme` and the widget broadcast. Put every Settings, tray, widget
  menu, native dialog, widget-shell, permission, and toast string in
  `src/renderer/i18n/en.json` behind `t()`, including the main-process helper. Use the existing
  `HotkeyService` to register the saved accelerator and restore the previous value on failure.
  Keep Start with Windows packaged-only and read it back through `getLoginItemSettings()`.
- **Evidence:** `npm run typecheck`, `npm run lint`, and `npm run build` pass after the change.
  `npm test` passes 186 tests, including new startup, hotkey, and diagnostics tests. The
  packaged and keyboard/manual checks remain in `docs/phase-7-manual-test.md`.
- **Alternatives considered:** Separate settings stores per tab would duplicate load and flush
  paths. Registering the login item in development would point at `electron.exe`. Hard-coded
  English strings would make the later translation pass a rewrite.
- **Follow-up:** Run the packaged checklist, including a reboot and onboarding reset.

## 2026-10-27 - Safe mode uses bounded startup history, not a permanent flag

- **Phase:** 7
- **Context:** Repeated crashes must not leave the app unusable, while a normal launch must clear
  the failure history and manual `--safe` must remain an explicit user action.
- **Decision:** Store attempt timestamps in `startup.json`, keep only attempts inside a
  two-minute window, and enter automatic safe mode when three attempts are present. Mark a
  start clean after 30 seconds of uptime. Manual `--safe` reports reason `flag` and does not add
  an attempt. Widget crashes are different: reload at most three times per minute, then disable
  the widget and expose the reason in Settings.
- **Evidence:** Unit coverage exercises the three-failure limit, manual safe mode, window
  expiry, clean marking, and Start normally reset. The forced-crash and Task Manager procedures
  are documented for the packaged run.
- **Alternatives considered:** A permanent safe-mode flag would require a manual reset after a
  transient crash. Counting any launch without a clean marker would treat a quick user quit as a
  crash.
- **Follow-up:** Verify the three forced crashes and a real widget-process kill on the packaged
  build.

## 2026-10-27 - Diagnostics and metrics stay opt-in and narrowly scoped

- **Phase:** 7
- **Context:** Diagnostics must be useful without leaking API keys or widget data, and the
  performance run must not change normal runtime behavior.
- **Decision:** Export only the three newest log files plus a generated `versions.txt`, then open
  the folder. Never copy the data folder or `secrets.json`. Metrics logging runs only when
  `HL_DEBUG_METRICS=1`, samples every 60 seconds, and ignores the first zero-CPU reading. The
  performance budget remains a packaged manual measurement; this decision does not claim
  measured values.
- **Evidence:** `tests/unit/diagnostics.test.ts` verifies newest-three selection, version output,
  and missing-log behavior. The metrics code is `src/main/services/metrics-logger.ts`. The exact
  static/live procedure and 8-hour calculation are in `docs/phase-7-manual-test.md`.
- **Alternatives considered:** Zipping the data folder would create a secret-leak risk. Logging
  metrics by default would add noise and overhead for every user.
- **Follow-up:** Fill the budget table only from real runs; if a target is missed, record the
  mitigation and final numbers here.

## 2026-10-27 - Foreground repin burst covers the desktop-switch animation

- **Phase:** 1/7 regression fix
- **Context:** Win+D and closing a covering window raise the shell desktop above the widget. A
  single immediate repin on `EVENT_SYSTEM_FOREGROUND` was undone while the shell animation was
  still running, and the 2-second maintenance tick could leave the widget hidden for roughly
  0.5-1 second.
- **Decision:** Keep the `SetWinEventHook` foreground watcher, but when foreground changes,
  repin immediately and continue repinning every 40 ms for 800 ms, with a final repin after the
  burst. Keep the 2-second maintenance interval as the idle fallback. Allow `HL_LOG_LEVEL` to
  select the electron-log file/console level for runtime diagnosis.
- **Evidence:** In a packaged isolated run (`--user-data-dir`), a single foreground repin stayed
  below the raised desktop until roughly 400-800 ms. With the burst, the widget was above the
  raised desktop within 150 ms of Win+D and stayed there through the remaining 1.6-second
  observation. `npm test` passes 186 tests; typecheck, lint, and `build:unpack` pass.
- **Alternatives considered:** Transient `HWND_TOPMOST` would cover normal windows during other
  foreground changes. Increasing the maintenance rate would spend CPU continuously instead of
  only during a transition. A single immediate repin was insufficient because the shell reorders
  the desktop during the animation.
- **Follow-up:** Confirm the packaged Win+D and close-covering-window behavior manually, then
  measure normal idle CPU again in the Phase 7 performance run.

## 2026-10-27 - Settings uses a sidebar studio and variants use one manifest contract

- **Phase:** 7B
- **Context:** Phase 7 exposed every control at once, widget designs were fixed at install
  time, and previews were either missing or static. Appearance accents and cursor packs also
  needed to stay scoped to HomeLayer rather than changing Windows pointers.
- **Decision:** Replace the tab strip with a grouped sidebar shell (Home, Widgets, Wallpaper,
  Apps, AI Studio, General) and a workspace header that owns status, safe mode, and notices.
  Browse widgets in a searchable category studio with live previews and explicit design
  pills; keep desktop management and saved AI widgets in separate views. Represent every
  built-in design in `BUILTIN_WIDGETS.variants`; store the chosen `variant` on the manifest
  and pass it to the shell as `?variant=<id>`. Built-ins switch presentation with
  `data-variant` on the root element. Preview iframes use
  `widget://_builtins/<type>/index.html?variant=<id>&preview=1` with demo data enabled by the
  SDK context. Accent and app cursor choices remain app-local CSS tokens; cursor packs are
  data-URI SVGs applied in Settings and widget edit chrome, with the later opt-in system-wide
  pointer described below. Remove native opacity and
  use CSS opacity on the frame so transparent rounded corners composite correctly. Keep
  `color-scheme: normal` on preview iframes; a mismatched parent scheme makes Chromium paint
  an opaque white canvas behind otherwise transparent widget designs.
- **Evidence:** `npm run typecheck`, `npm run lint`, and `npm run build` pass.
  `npm test` passes 194 tests, including new `_builtins` host containment, variant fallback,
  schema rejection, and service install/switch coverage. All eight built-in HTML files were
  checked for a variant bootstrap, theme listener, no manual SDK tag, and valid inline
  JavaScript. An isolated Electron smoke run captured all 24 designs in dark and light,
  verified live variant URLs, appearance changes, 720x520 responsiveness, and scroll reset.
  Interactive desktop checks are tracked in `docs/phase-7b-manual-test.md`.
- **Alternatives considered:** Keeping separate preview HTML would duplicate every design.
  Passing variant data through IPC on every render would add a second source of truth.
  Native window opacity cannot round corners cleanly over arbitrary wallpapers. System-wide
  cursor replacement was deferred because it changes user-wide state.
- **Follow-up:** Smoke-test Settings at 880x620 and 720x520 in dark, light, and each accent;
  confirm variant switching, cursor packs, previews, widget corners, and opacity before
  Phase 8.

## 2026-10-27 - System-wide cursor is an explicit opt-in

- **Phase:** 7B follow-up
- **Context:** Cursor packs were intentionally app-local, but a pack should be able to follow
  the pointer across Windows. Replacing a system cursor changes user-wide state and needs a
  reliable restore path.
- **Decision:** Keep app-local cursors by default and add a Windows-only **Use outside
  HomeLayer** toggle stored as `cursorSystemWide`. Generate 32, 48, and 64 px `.cur` assets
  from the same Dot/Neon/Pixel artwork and replace only `OCR_NORMAL` with
  `LoadCursorFromFileW` + `SetSystemCursor`. Leave text, hand, and resize cursors native.
  Restore with `SystemParametersInfoW(SPI_SETCURSORS)` when the toggle is disabled, when the
  pack changes to System, and on normal quit. Reapply the saved preference on startup. Do not
  write the Windows cursor-scheme registry.
- **Evidence:** `tests/unit/system-cursor.test.ts` verifies multi-image CUR layout,
  apply/switch/restore, missing-file handling, and unavailable backends. An isolated Electron
  smoke run confirmed: the toggle is disabled with System, enabled with Neon, the preference
  persists, quitting restores the pointer, relaunching reapplies it, and disabling restores it.
  A packaged `build:unpack` run confirmed the `.cur` assets load from `app.asar.unpacked` and
  that Pixel applies and restores on quit. A native Win32 check returned success for loading
  each `.cur`, setting `OCR_NORMAL`, and calling `SPI_SETCURSORS`.
- **Alternatives considered:** Persisting registry values would survive HomeLayer and require
  a separate restore path. Replacing every `OCR_*` role with pointer artwork would hurt text
  and resize usability. Always-on system-wide replacement would surprise users.
- **Follow-up:** Manual check at 100%, 125%, and 150% scaling, and confirm the user's Windows
  cursor scheme is unchanged after quitting. After a crash, relaunch HomeLayer and disable the
  toggle to restore the pointer.
