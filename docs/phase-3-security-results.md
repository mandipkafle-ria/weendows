# Phase 3 security results

- Date: 2026-10-25
- Status: APPROVED by owner on 2026-10-25 (`approved: phase 3`)
- Build: packaged `dist/win-unpacked/HomeLayer.exe`
- Windows: 10.0.26200 x64
- Electron: 44.9.3
- Scaling: 125%
- Display: one 1536x864 DIP primary work area
- Script: `scripts/phase-3-security.mjs`

## Gates

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: PASS, 8 files / 74 tests
- `npm run build`: PASS
- `npm run build:unpack`: PASS

Run the security script against the unpacked app:

```powershell
$env:HOMELAYER_EXE = (Resolve-Path 'dist\win-unpacked\HomeLayer.exe').Path
node scripts/phase-3-security.mjs
```

The script creates temporary probe widgets (the all-permission `security-probe`, a liveness
probe, and openLink probes with and without permission), runs the table, and restores the
original `layout.json` and removes the probes in `finally`. For a development run, omit
`HOMELAYER_EXE` and run `node scripts/phase-3-security.mjs` after `npm run build`.

## Security table

| Attack inside a widget                                                    | Result | Evidence                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch('https://example.com')`                                            | PASS   | `TypeError: Failed to fetch`; the console showed a CSP violation.                                                                                                                                                                                                                         |
| `new Image().src` with a remote URL and data in the query                 | PASS   | `onerror` fired; `img-src data: blob:` blocked the request.                                                                                                                                                                                                                               |
| `window.parent.document`                                                  | PASS   | `SecurityError`.                                                                                                                                                                                                                                                                          |
| `window.top.location` set to a web address                                | PASS   | `SecurityError`; the shell URL stayed on the widget shell.                                                                                                                                                                                                                                |
| `window.open('https://example.com')`                                      | PASS   | Returned `null`.                                                                                                                                                                                                                                                                          |
| `localStorage.setItem('a', 'b')`                                          | PASS   | `SecurityError`; the origin is opaque.                                                                                                                                                                                                                                                    |
| `require('fs')`, `process`, `window.electron`                             | PASS   | All three were `undefined`.                                                                                                                                                                                                                                                               |
| A meta refresh tag pointing at a web address                              | PASS   | A direct widget-session window emitted `did-fail-load` with code `-20` (`ERR_BLOCKED_BY_CLIENT`) for `https://example.com/`.                                                                                                                                                              |
| `hl.net.fetch` to `http`, `127.0.0.1`, `localhost`, or an unapproved host | PASS   | All four returned `network_blocked`.                                                                                                                                                                                                                                                      |
| `hl.net.fetch` to a name that resolves to a private address               | PASS   | Vitest `createSafeLookup` tests cover private and mixed DNS results.                                                                                                                                                                                                                      |
| `hl.storage.set` with a 300 KB value                                      | PASS   | Returned `too_large`.                                                                                                                                                                                                                                                                     |
| 100 `hl` calls in one second                                              | PASS   | 26 calls succeeded and 74 returned `rate_limited`.                                                                                                                                                                                                                                        |
| `hl.launch.app` with a file path                                          | PASS   | `C:\Windows\notepad.exe` returned `invalid_args`; an unknown id returned `not_found`.                                                                                                                                                                                                     |
| `hl.openLink` approval and rate limit                                     | PASS   | The first call prompted with `This widget wants to open example.com in your browser.`, opened `https://example.com/one`, and an immediate second call returned `rate_limited`. After 3 seconds a different host opened without a second prompt, confirming approval is cached per widget. |
| `hl.openLink` denial and permission check                                 | PASS   | Cancelling the prompt returned `permission_denied` / `opening links was not approved` and did not open a URL. A widget without `openLink` permission returned `permission_denied` / `permission not granted: openLink` without prompting.                                                 |
| `hl.openLink` invalid URLs                                                | PASS   | `ftp:`, `file:`, and credential-bearing `https:` URLs returned `invalid_args` before prompting or opening.                                                                                                                                                                                |
| `while(true) {}` in the widget                                            | PASS   | The heartbeat showed `Widget not responding` with Reload and Disable. A separate liveness probe kept updating while the frozen probe was unresponsive. Reload restored the probe; Disable removed it.                                                                                     |
| Calling the widget API from a window that is not a widget shell           | PASS   | A normal `BrowserWindow` with the shell preload received `permission_denied` / `Unknown widget sender`.                                                                                                                                                                                   |

## Additional Phase 3 checks

| Check                        | Result | Evidence                                                                                                                                                                               |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System widget                | PASS   | Packaged app showed CPU and memory bars and the 2-second sample label.                                                                                                                 |
| Battery widget               | PASS   | Packaged app showed `100%`, `Charging`, and `Connected to power`.                                                                                                                      |
| Notes widget                 | PASS   | Saved `phase3 packaged <timestamp>` through `hl.storage`; value survived an app restart.                                                                                               |
| Weather widget               | PASS   | Packaged app showed `LONDON, GB`, `12°C Partly cloudy`, and `Updated just now`; city and conditions survived a restart.                                                                |
| Interactive keyboard input   | PASS   | Notes and Weather opted into keyboard focus; after focusing their inputs, `document.hasFocus()` was true and typed text reached the widget. System and Battery remained non-focusable. |
| Permission revocation        | PASS   | Revoking Notes `storage` made the next `hl.storage.get` return `permission_denied`; restoring it made the next call succeed.                                                           |
| Badge Reload                 | PASS   | Reload destroyed and recreated the frozen widget window; the probe rendered again.                                                                                                     |
| Badge Disable                | PASS   | Disable removed the probe window and Settings showed the disabled notice.                                                                                                              |
| Three failures in one minute | PASS   | A three-freeze run disabled Clock after the third report; the other four widgets remained.                                                                                             |

## Notes

- The `while(true)` result is recorded in `docs/decisions.md`.
- The heartbeat is 4 seconds with a 12-second timeout. It exists because Electron's
  `BrowserWindow` `unresponsive` event did not fire when only the sandboxed iframe froze.
- `webContents.reload()` left the shell loading forever with the frozen child frame. Reload now
  destroys and recreates the `BrowserWindow`.
- The openLink probes stub `dialog.showMessageBox` and `shell.openExternal` so the automated run
  does not open a browser or require native dialog interaction. The prompt copy, approval,
  denial, rate-limit, and permission paths are exercised through those stubs.
- No security-table row failed.
