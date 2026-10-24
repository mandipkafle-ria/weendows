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
