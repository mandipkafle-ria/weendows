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
