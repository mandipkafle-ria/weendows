# Phase 2 verification results

- Date: 2026-10-25
- Build: packaged `dist/win-unpacked/HomeLayer.exe`
- Windows: 10.0.26200 x64
- Electron: 44.9.3
- Scaling: 125%
- Display: one 1536x864 DIP primary work area

## Gates

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test`: PASS, 5 files / 42 tests
- `npm run build:unpack`: PASS

## Automated checks on the packaged app

| Check | Result | Evidence |
| --- | --- | --- |
| Settings renders | PASS | Gallery, desktop list and edit-mode panel visible. |
| Widget bridge | PASS | `window.api` and `window.shellApi` present in the packaged app. |
| Clock/date/calendar built-ins | PASS | All three rendered; Calendar highlighted 25 October 2026. |
| Add three widgets | PASS | Gallery count reached 3; placements cascaded by 24 DIP. |
| Remove dialog cancel | PASS | Clock stayed; Settings said `Removal cancelled.` |
| Remove dialog confirm | PASS | Clock placement and window disappeared; `widgets/clock/index.html` remained. |
| Restart persistence | PASS | `layout.json` hash was unchanged across stop/start; all three windows returned. |
| Delete `layout.json` | PASS | One Clock was seeded at `48,48`; layout was recreated. |
| Corrupt `layout.json` | PASS | `layout.json.corrupt-<timestamp>` written; warning notice shown; default Clock seeded. |
| Valid empty layout | PASS | `{ "schema": 1, "placements": [] }` stayed empty; no Clock was seeded. |
| Missing display fallback | PASS | Fake `displayId` and off-screen coordinates showed the widget at `1488,816` with 48 DIP visible; saved placement was not overwritten. |
| Hotkey conflict | PASS | Holding Ctrl+Alt+E from another process produced the warning notice and no crash; restart after release showed no warning. |
| Edit overlay | PASS | Dashed border, gear, close and resize handle visible in all shells. |
| Packaging preload fix | PASS | `isolatedEntries` removed the unsupported preload chunk require. |

## Manual checks on the packaged app

| Check | Result | Evidence |
| --- | --- | --- |
| Drag and 8 DIP snap | PASS | User confirmed dragging; an automated drag moved Date from `864,464` to `1024,664`. Release snapped to the 8 DIP grid and kept `160x104`. |
| Drag smoothness | PASS | User confirmed dragging works smoothly. Tested at 125% scaling; 100% and 150% were not available. |
| Resize and 8 DIP snap | PASS | Date resized from `160x104` to `240x184`; the top-left stayed at `1024,664`; both final dimensions are multiples of 8. |
| Magnetism and Alt bypass | PASS | With Date right edge 8 DIP from Clock, release snapped `x` to `880`. The same target with Alt held stayed at `872`. |
| Minimum-size clamp | PASS | Shrinking Date stopped at `160x104`; the 100 DIP minimum is rounded up to the 8 DIP grid on release. |
| Ctrl+Alt+E | PASS | Actual key input toggled edit mode on and off; Settings changed between `Edit layout` and `Finish editing`. |
| Right-click menu | PASS | User tested all right-click edit options successfully. |
| Lock/Unlock | PASS | Lock set `locked=true`, dimmed the overlay and hid the toolbar/handle; resize did not change the window. Unlock restored the placement. |
| Reload | PASS | User-verified through the right-click menu. |
| Opacity 80/60 | PASS | User-verified live opacity changes through the right-click menu. |
| Remove confirmation | PASS | Settings Cancel/Remove paths passed; the user also verified the right-click Remove option. |
| Tray toggle | PASS | User confirmed Ctrl+Alt+E and the tray menu both toggle edit mode, including the menu checkmark. |
| Physical monitor unplug/replug | MOVED | No second monitor available. Per owner instruction on 2026-10-25 this row moves to the last phase (Phase 8). Not marked PASS. |

## Deferred gate

- **Physical second-monitor unplug/replug:** deferred because no second monitor is available. Per
  owner instruction, this row is moved out of Phase 2 and must be run in the last phase
  (Phase 8) before release. This is not marked PASS; the single-monitor fallback path is covered
  by the missing-display test above.

Manual interaction used a single 1920x1080 primary display at 125% scaling (1536x864 DIP work area). Widget windows are intentionally pinned above the desktop, so OS automation temporarily forced the tested widget topmost; normal user clicks were also confirmed by the user.

Step-by-step instructions are in [phase-2-manual-test.md](phase-2-manual-test.md).