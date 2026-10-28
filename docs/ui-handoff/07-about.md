# 07 — About

**Source:** `src/renderer/settings/AboutPanel.tsx`
**Styles:** `main.css` — `.about-hero`, `.about-version`, `.section-head`,
`.license-details`, `.native-result`, `.status-ok`, `.status-error`, `.status-idle`,
`.tick`

## 1. Purpose

Identity and recovery: version/platform, restoring the original Windows wallpaper,
reporting problems, third-party licenses, and a native-layer diagnostic check. It is
the app's "trust and troubleshooting" page.

## 2. Current layout

```
About
Version, licenses and recovery tools.                           ● Running  v1.4.2
──────────────────────────────────────────────────────────────────────────────
┌─ HOMELAYER ────────────────────────────────────────────────────────────────┐
│ About HomeLayer                              Version 1.4.2                 │
│ Version, licenses and recovery tools.        win32 / x64                   │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Windows wallpaper ───────────────────────────────────── [Restore Windows…]┐
│ If HomeLayer set your wallpaper, restore the one Windows had before.        │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Problems and feedback ───────────────────────────── [Open the issue tracker]┐
│ Report a bug or suggest an improvement on GitHub.                           │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Third-party licenses ─────────────────────────────────────────────────────┐
│ HomeLayer uses open-source software and the DotGothic16 font.              │
│ ▸ Third-party licenses                                                     │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Native check ───────────────────────────────────────────── [Run native check]┐
│ Call user32.dll through koffi and find the Windows Progman window.          │
│ [Not run]  (status + detail + tick count after running)                     │
└────────────────────────────────────────────────────────────────────────────┘
```

Five full-width cards stacked with 14 px gaps. Every card uses the same panel
treatment, so identity, destructive/recovery actions, external links, legal text, and
a developer diagnostic all share equal visual weight.

## 3. Component inventory

| Element | Details |
|---|---|
| Hero | Eyebrow **HomeLayer**, h2 **About HomeLayer**, intro; version block right with **Version {version}** and **{platform} / {arch}** |
| Restore | Copy + primary **Restore Windows wallpaper**; calls `restoreOriginalWallpaper`; success/error toast |
| Issue tracker | Copy + **Open the issue tracker**; calls `openExternal('https://github.com/mandipkafle-ria/weendows/issues')` |
| Licenses | Async `getLicenses()`; loading text; error text; collapsed `<details>` whose summary repeats the title, containing a `<pre>` of the full license text |
| Native check | Copy + **Run native check**; `nativeCheck()`; shows Not run / PASS / FAIL, Progman handle or error, and tick count |
| Footer | None |

## 4. Copy inventory

- **About HomeLayer** · **Version, licenses and recovery tools.**
- **Version {version}** · **{platform} / {arch}**
- **Windows wallpaper** · **If HomeLayer set your wallpaper, restore the one Windows
  had before.** · **Restore Windows wallpaper** · **Windows wallpaper restored.**
- **Third-party licenses** · **HomeLayer uses open-source software and the DotGothic16
  font.** · **Could not load licenses: {error}**
- **Problems and feedback** · **Report a bug or suggest an improvement on GitHub.** ·
  **Open the issue tracker**
- **Native check** · **Call user32.dll through koffi and find the Windows Progman
  window.** · **Run native check** · **Progman handle: {handle}** ·
  **Progman window not found** · **Native check failed: {error}** ·
  **Tick count: {count}**
- Status: **Not run**, **PASS**, **FAIL**, **Checking...**

## 5. Behaviour and data

- `getLicenses()` on mount; no retry.
- Restore → `restoreOriginalWallpaper()`, independent of the Wallpaper tab state; toast
  on success/error.
- Issue tracker → `openExternal(url)`; button disabled while opening (no spinner label).
- Native check → `nativeCheck()` returning `{ok, progmanHandle, tickCount, error?}`;
  PASS requires `ok` **and** a non-null Progman handle.
- Uses `GeneralState` only for version/platform/arch.
- No network calls except the externally opened issue page.

## 6. Current styling notes

- `.about-hero` is a flex row with copy left and `.about-version` right; collapses to a
  column below 780 px.
- All cards use 22 px padding and 14 px radius; headings 17 px.
- Section-head cards place the action at the far right; buttons are standard height.
- License `<details>` has a bordered summary; `<pre>` is small mono with its own
  scroll; full text can be thousands of lines.
- Native result row is 12 px with colored status text; idle is muted, PASS green, FAIL
  red; tick count is a separate mono-ish span.
- No illustrations, icons, or grouping; the page reads as a list of paragraphs.

## 7. UX observations

1. **No emotional payoff** for an About page: no logo/mark, no short product story, no
   website/docs/community links, no build channel.
2. **Version appears three times** across the shell and this page (header pill, sidebar
   footer, About hero).
3. **Restore is duplicated** in Wallpaper and here, with different surrounding context
   and no indication whether HomeLayer currently owns the wallpaper. Pressing it when
   there is no original may fail or do nothing.
4. **Native check is developer jargon** exposed with equal weight to user-facing
   recovery. "Call user32.dll through koffi", "Progman handle", and "Tick count" are
   meaningless to most users.
5. **Licenses default to a closed disclosure** whose summary duplicates the section
   title; when opened, raw text inside a `<pre>` is hard to navigate or search.
6. **Issue tracker is the only feedback path**; no copy-diagnostics shortcut, no
   “include logs” guidance, no email/discord.
7. **No changelog / release notes** or update status.
8. All five cards have the same visual weight; the useful actions (restore, report)
   are buried among legal/diagnostic content.
9. The About h2 repeats the nav/header label and the intro repeats the header subtitle.
10. No visible success state for restore beyond a toast; the button label shows the
    generic **Saving...** while restoring.

## 8. Design brief for the AI

Turn About into a compact identity + support page:

- Lead with a real brand block: mark/wordmark, version, build channel, platform, and
  one short line about HomeLayer. Remove duplicate version/subtitle text from the
  page body.
- Group links (website, docs, issue tracker, licenses) into a clean row/list with
  external-link affordances. Keep the existing URLs and `openExternal`.
- Present **Recovery** as a distinct card with current wallpaper ownership/status if
  available; if the backend cannot report ownership, phrase the action conditionally
  and handle the no-original case gracefully. Consider removing the duplicate from
  Wallpaper or clearly cross-linking.
- Move **Native check** into an **Advanced / Diagnostics** disclosure with plain-language
  explanation, a copyable result, and a link to export diagnostics (General).
- Make licenses a readable, searchable surface (list of packages with versions and
  links, plus full text on demand); avoid dumping raw text by default.
- Add a small footer with copyright and “made for Windows” style attribution if copy
  exists; do not invent legal claims.
- Keep `getLicenses`, `nativeCheck`, `restoreOriginalWallpaper`, and `openExternal`.
  No new dependencies or remote content.

## 9. Output format

Return `AboutPanel.tsx` + CSS scoped to `.about-*`. Provide new i18n keys and confirm
how the layout collapses at 720 × 520. Keep links and IPC unchanged.
