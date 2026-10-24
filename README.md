# HomeLayer

**Work in progress.** HomeLayer is a customizable Windows desktop layer: widgets live on the
desktop, an app grid opens from a hotkey, and AI-assisted tools help create new widgets. The
goal is a calm, local-first desktop that stays useful without getting in the way.

This repository is at Phase 0: a tray app with a settings window, a packaged koffi/Win32 smoke
test, and CI.

## Requirements

- Windows 10 22H2 or Windows 11
- Node.js 22 or newer
- npm

## Development

```powershell
npm install
npm run dev
```

Other commands:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run dist
```

`npm run dist` builds the NSIS installer and portable Windows executable with
electron-builder.

## Native check

Open the tray menu and choose **Open settings**, then press **Native check**. The settings
window calls `user32.dll` and `kernel32.dll` through koffi and reports the Progman window
handle.

## License

MIT. See [LICENSE](LICENSE).
