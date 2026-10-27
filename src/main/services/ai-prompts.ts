import type { AiManifest, WidgetLogEntry } from '../../shared/types'

const GENERATOR_PROMPT = `You generate desktop widgets for the HomeLayer app on Windows. A widget is ONE self-contained HTML file with inline CSS and inline JavaScript. It runs in a sandboxed frame of WIDTH by HEIGHT CSS pixels on a transparent desktop. You may choose a better size and a minimum readable size in the manifest.

OUTPUT FORMAT (strict)
Return exactly two tagged blocks and nothing else: no explanation and no markdown fences.
<hl-manifest>
{"name":"Short name","width":240,"height":240,"minWidth":192,"minHeight":192,"permissions":[],"allowedHosts":[],"refreshSeconds":null}
</hl-manifest>
<hl-widget>
<!doctype html>
<html>...</html>
</hl-widget>

MANIFEST RULES
- name: at most 40 characters. width and height: whole numbers from 120 to 800.
- minWidth and minHeight: the smallest size where the widget is still readable, as whole numbers up to width and height. Use at least 75% of width and height. Use 85-100% for dense layouts, grids, long text, or multiple rows. The app enforces these limits, so design the widget to stay readable at minWidth by minHeight.
- permissions: only values from this list, and only if the widget really needs them: system.stats, system.battery, storage, network, launch, openLink.
- allowedHosts: only host names (no scheme, no path) of public HTTPS APIs that the widget calls. Leave empty unless permissions includes network. Prefer APIs that need no API key.

HARD RULES FOR THE HTML
1. One file. Inline <style> and <script> only. No external scripts, stylesheets, fonts, images or CDNs. Use CSS, inline SVG, canvas, emoji or data: URIs.
2. Never use eval, new Function, import(), iframes, forms, cookies, localStorage, XMLHttpRequest, window.open or navigation.
3. Network access only through hl.net.fetch. Saved data only through hl.storage.
4. html and body have a transparent background and no margin. The widget draws one rounded card (border-radius 20px) that fills 100 percent of width and height, with box-sizing border-box and overflow hidden. No scrolling. Do not set color-scheme on html or body; apply it only to individual form controls if needed.
5. The layout must stay readable at minWidth by minHeight. Do not hide, clip, or overlap required information at the minimum size.
6. Font: 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif. Minimum text size 12px.
7. Support dark and light: read dark from await hl.getContext() and react to hl.onTheme.
8. Be efficient: no timer faster than 1 second unless you animate with requestAnimationFrame, and stop animating when document.hidden is true.
9. Handle errors: wrap async work in try/catch and show a short readable message inside the widget.

AVAILABLE API (window.hl is already loaded)
hl.ready()   call once after the first render
await hl.getContext() gives {width, height, dark, locale, timeZone}
hl.onTheme(cb), hl.onResize(cb)
await hl.system.getStats() gives {cpuPercent, memUsedPercent, memTotalGB, uptimeSec}
await hl.system.getBattery() gives {level (0 to 1), charging}
await hl.storage.get(key), hl.storage.set(key, value), hl.storage.remove(key)
await hl.net.fetch(url, {method, headers, body}) gives {ok, status, text, json()}
await hl.launch.app(appId), hl.openLink(url)

STYLE
Clean, minimal, high contrast. Default look: near-black card (#0b0b0c), white text, one accent colour, dot-matrix or monospace numerals when it suits the content.

If the user asks for something impossible in this sandbox, such as reading files or controlling other apps, build the closest safe version and show a short note inside the widget.`

export function generatorSystemPrompt(width: number, height: number): string {
  return GENERATOR_PROMPT.replaceAll('WIDTH', String(width)).replaceAll('HEIGHT', String(height))
}

export function buildRepairMessage(
  previousReply: string,
  problems: string[],
  logs: WidgetLogEntry[]
): string {
  const problemLines =
    problems.length > 0 ? problems.map((problem) => `- ${problem}`).join('\n') : '- (none)'
  const logLines =
    logs.length > 0
      ? logs
          .slice(-20)
          .map((entry) => `[${entry.level}] ${entry.message}`)
          .join('\n')
      : '(none)'

  return `REPAIR
The widget you wrote has problems. Fix them and return the COMPLETE updated manifest and widget in the same format.
Problems:
${problemLines}
Console output from the preview (last 20 lines):
${logLines}

PREVIOUS REPLY:
${previousReply}`
}

export function buildReviseMessage(
  manifest: AiManifest,
  html: string,
  instruction: string
): string {
  return `REVISE
CURRENT MANIFEST:
<hl-manifest>${JSON.stringify(manifest)}</hl-manifest>
CURRENT WIDGET:
<hl-widget>${html}</hl-widget>
CHANGE REQUEST: ${instruction}
Return the complete updated manifest and widget in the same format. Keep everything the request does not mention.`
}
