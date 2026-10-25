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
  | --- | --- | --- | --- | --- | --- |
  | 1 | 1 | 69.5 MB | 23.6 MB | 69.5 MB | 23.6 MB |
  | 3 | 3 | 242.7 MB | 71.3 MB | 80.9 MB | 23.8 MB |
  | 5 | 5 | 416.2 MB | 118.1 MB | 83.2 MB | 23.6 MB |

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
