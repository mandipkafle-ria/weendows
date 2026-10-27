# Phase 4 AI widget results

- Date: 2026-10-25
- Status: Implementation complete; real Gemini checks passed. Owner approval pending.
- Build: packaged `dist/win-unpacked/HomeLayer.exe`
- Windows: 10.0.26200 x64
- Electron: 44.9.3
- Scaling: 125%
- Provider: Google Gemini with the key already stored by the owner. The key was never printed
  or written to logs.

## Gates

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: PASS, 10 files / 105 tests
- `npm run build`: PASS
- `npm run build:unpack`: PASS

## Real Gemini checks

| Check                                  | Result | Evidence                                                                                                            |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Test connection                        | PASS   | Connected with 46 models available.                                                                                 |
| Generate dotted battery and CPU widget | PASS   | Prompt `dotted battery and CPU widget` produced `Dotted Stats`, 240x240, 0 repairs, with a clean preview.           |
| Permission approval                    | PASS   | The approval dialog named battery and CPU access. The saved manifest requested `system.stats` and `system.battery`. |
| Save to desktop                        | PASS   | The widget was written with `kind: "ai"` and one placement.                                                         |
| Edit with AI                           | PASS   | Revision changed only the HTML; name, size, and permissions were unchanged.                                         |
| Undo                                   | PASS   | Undo restored the original HTML byte-for-byte.                                                                      |

`gemini-3.8-flash` exceeded the required 60-second request timeout. The acceptance run used
`gemini-3.5-flash-lite`, which completed normally. The timeout was left at 60 seconds.

## Local OpenAI-compatible checks

A temporary local OpenAI-compatible server and temporary Playwright scripts were used. They
were removed after the run, and `layout.json`, AI settings, widget directories, and preview
directories were restored.

| Check                           | Result | Evidence                                                                                                                                             |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key storage                     | PASS   | Saved key was absent from `secrets.json` as plaintext; the decrypted key was used only in the provider request header. Remove key deleted the entry. |
| List models and test connection | PASS   | The OpenAI-compatible adapter listed and tested against the local mock. This is not a live third-party provider.                                     |
| Generate, save, edit, undo      | PASS   | The full preview and save flow worked, including edit mode and history restore.                                                                      |
| Repair direct `fetch`           | PASS   | The direct-fetch reply was flagged, repaired to `hl.net.fetch`, and returned a preview-ready result after one repair.                                |
| Repair cap                      | PASS   | An always-invalid reply made exactly 3 provider requests and stopped after 2 automatic repairs with a clear message.                                 |
| 401                             | PASS   | `The key was rejected. Check that it is correct and has access to this model.`                                                                       |
| 429                             | PASS   | Included `Retry after 7 seconds.` from the response header.                                                                                          |
| Offline                         | PASS   | `No connection to the provider. For Ollama, check that it is running.`                                                                               |
| Timeout                         | PASS   | A real Gemini request exceeded 60 seconds and returned the timeout message.                                                                          |
| Cancel                          | PASS   | Cancelled in 47 ms; no result replaced the cancelled state.                                                                                          |
| Logs                            | PASS   | `main.log` contained no key, prompt, or widget code.                                                                                                 |
| Console errors                  | PASS   | No renderer console errors during the packaged runs.                                                                                                 |

## UI follow-up

The model field now keeps a free-text id but also shows a `Choose a loaded model...` select
after `Load models`. The select lists every returned model and fills the model id when chosen.
If no model is selected, `Generate widget` shows an inline sticky error and focuses the model
field instead of silently failing.

Long-running actions now show a sticky progress bar with a spinner. Generate and Revise explain
that a preview is being created and that nothing is saved until the user approves permissions.
A packaged UI run with three mock models confirmed the no-model error, the model choices, model
selection, the progress state, and cancellation.

## Minimum resize threshold

AI widgets previously inherited a fixed 120 by 80 minimum, so a 240 by 240 widget could be
shrunk until its content became unreadable. The generator manifest now includes `minWidth` and
`minHeight`. The prompt asks for the smallest readable size, with at least 75 percent of the
design width and height and 85 to 100 percent for dense layouts. The prompt also requires the
HTML to stay readable at that minimum.

The parser fills in a 75 percent minimum when the model omits it, raises a lower value, keeps a
larger one, and clamps values above the design size. The saved widget uses those limits, and the
resize path, initial window sizing, and AI edit path all enforce them. Older AI manifests with a
lower stored minimum are raised to the same floor when loaded.

A packaged run resized a 240 by 240 AI widget toward 40 by 40. It stopped at 184 by 184, the
nearest 8-pixel snap above the 180 by 180 minimum. Repeating with a legacy 120 by 120 minimum
produced the same result.

## Widget corner transparency

The widget shell was setting `color-scheme: dark` on the shell document. In a transparent
Electron window, that made the embedded widget frame paint an opaque white canvas, so the
square corners behind a rounded card appeared white. A widget that set its own dark
`color-scheme` or legacy `meta` tag painted an opaque dark canvas instead.

The shell no longer sets a document color scheme. The widget protocol now strips legacy
`color-scheme` meta tags and injects a base style that keeps `html`, `body`, and `:root`
transparent. Built-in widgets keep `color-scheme: dark` only on their form controls. A
packaged run with a legacy widget containing both the meta tag and a dark `:root` produced
transparent corners, and the built-in Clock produced a transparent rounded card with only its
soft shadow outside the radius.

## Saved AI widgets

Removing an AI widget used to delete its files. It now removes only the desktop placement and
keeps the widget under `%APPDATA%\HomeLayer\widgets\<id>\`. The Widgets tab lists unplaced AI
manifests in an **AI generated** section. **Add copy** duplicates the saved widget and places
the copy, and **Delete** is a separate permanent action with its own confirmation.

The source directory remains the only store; no database or separate index is used. The
manifest scan that runs at startup already discovers these widgets. Unit tests cover preserving
the files on removal, copying without consuming the source, and permanent deletion. The full
suite passes with 16 files / 141 tests, and `npm run build` passes.

A packaged Playwright check passed 6/6: the saved widget appeared in **AI generated**, **Add
copy** created a separate persisted id and files, the source stayed saved, **Remove** kept the
copy's files, and **Delete** removed only the selected widget. The temporary profile was
`C:\Users\Hi\AppData\Local\Temp\opencode\ai-library-userdata`; the normal profile was not used.

## Remaining acceptance items

- Test connection against a live third-party OpenAI-compatible provider or Ollama. The local
  mock validates the adapter but is not a live provider.
- Exercise the runtime prompt-injection case with untrusted API text.
- Owner review and approval of Phase 4.

No commit was made.
