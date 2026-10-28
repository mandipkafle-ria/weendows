# 08 — Onboarding

**Source:** `src/renderer/settings/Onboarding.tsx`
**Styles:** `main.css` — `.onboarding`, `.onboarding-shell`, `.onboarding-head`,
`.onboarding-progress`, `.onboarding-body`, `.onboarding-privacy`,
`.onboarding-widgets`, `.onboarding-widget`, `.onboarding-actions`, `.brand-dots`

## 1. Purpose

First-run setup shown **instead of the settings shell** until completed or skipped.
It introduces the product and privacy model, lets the user pick three starter widgets,
and optionally stores a Google Gemini API key.

## 2. Current layout

```
┌──────────────────────── full settings window (centered) ────────────────────┐
│  ┌─ onboarding shell (max 720, min-height 500) ───────────────────────────┐  │
│  │  ••••  HomeLayer                                   Step 1 of 3         │  │
│  │        Welcome                                                          │  │
│  │  ▬▬▬▬▬▬▬▬▬▬ ▬▬▬▬▬▬▬▬▬▬ ▬▬▬▬▬▬▬▬▬▬                                   │  │
│  │                                                                         │  │
│  │  WELCOME                                                                │  │
│  │  Make Windows feel like yours                                           │  │
│  │  HomeLayer keeps widgets and wallpapers behind your windows…            │  │
│  │                                                                         │  │
│  │  ┌─ Privacy at a glance ─────────────────────────────────────────────┐  │  │
│  │  │ Widgets run offline unless you approve a permission…              │  │  │
│  │  └───────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  │  [Skip setup]                                    [Next]                 │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Step 2 replaces the body with three checkbox cards (Clock, System, App grid). Step 3
shows a single optional Gemini key field. Progress remains at the top; the footer
always has **Skip setup** on the left, then Back (from step 2) and Next/Finish.

## 3. Component inventory

| Element | Details |
|---|---|
| Backdrop | Centered card over the window background; no overlay image or illustration |
| Brand | Four-dot mark (**not** the sidebar brand mark) + HomeLayer + **Welcome** |
| Step counter | `Step {current} of {total}` (total hardcoded 3) |
| Progress | Three 3 px bars, aria-hidden |
| Step 1 | Eyebrow **Welcome**, h2, body, privacy card |
| Step 2 | h2/body; checkbox cards for available starters; all selected by default |
| Step 3 | h2/body; password input for a Gemini API key |
| Footer | **Skip setup** (ghost), **Back** (secondary, step > 0), **Next** / **Finish setup** |
| Saving | All footer controls disabled; finish label **Saving...**; no spinner |

Starter definitions are `clock`, `system`, `app-grid`; each is hidden if not present in
`builtins`. Selection is a `Set<string>` of types.

## 4. Copy inventory

- Brand: **HomeLayer** · **Welcome** · `Step {current} of {total}`
- Step 1: eyebrow **Welcome** · **Make Windows feel like yours** · **HomeLayer keeps
  widgets and wallpapers behind your windows. This short setup takes less than a
  minute, and you can change everything later.**
- Privacy: **Privacy at a glance** · **Widgets run offline unless you approve a
  permission. Network access is limited to hosts you approve. AI prompts are sent only
  to the provider you choose, and API keys are encrypted on this PC.**
- Step 2: **Choose your first widgets** · **These three are a good starting point.
  Uncheck anything you do not want.**
  - **Clock** / **A quiet always-there clock.**
  - **System** / **CPU, memory and disk at a glance.** *(the widget actually shows CPU
    and memory, not disk)*
  - **App grid** / **Launch your apps from the desktop.**
- Step 3: **Connect AI (optional)** · **Add a Google Gemini API key to generate custom
  widgets. You can skip this now and add it later in the AI tab.** ·
  **Google Gemini API key** · placeholder **Optional API key** ·
  success **Gemini API key saved.**
- Footer: **Skip setup**, **Back**, **Next**, **Finish setup** → **Saving...**

Note: i18n also defines `onboarding.title` (**Set up your desktop layer**) which is
not used.

## 5. Behaviour and data contract

- Rendered by `App` when `general.onboardingCompleted` is false; receives `builtins`,
  existing `widgets`, `onComplete`, and `toast`.
- **Skip setup** calls `finish(true)`: saves nothing, adds nothing, calls
  `completeOnboarding()`, then replaces onboarding with the shell.
- **Finish setup** calls `finish(false)`:
  1. If the key field is non-empty, `saveAiKey('gemini', key)`; success/error toast.
  2. For each available starter that is selected **and not already on the desktop**
     (matched by `manifest.builtinType`), `addWidget(type)`.
  3. `completeOnboarding()` and `onComplete(general)`.
- Errors adding individual widgets are toasted but do not block completion.
- All selected by default; there is no "select at least one" requirement.
- No validation of the key, no provider/model test, no ability to choose another AI
  provider. The key is saved without verifying the connection.
- No theme, accent, cursor, or wallpaper choice; those live in General/Wallpaper.
- No direct access to settings or the app; skip is the only exit.

## 6. Current styling notes

- Backdrop: 34 px padding, card centered; the page keeps the app's accent radial glow.
- Card: 720 px max, 500 px min-height, 30 px padding, 18 px radius, 1 px border,
  large soft shadow.
- Header brand uses a four-dot pattern; step count is 12 px muted, top-right.
- Progress bars: 3 px, 6 px gap, accent fill for completed/current segments.
- Body max-width 580 px; h2 28 px with tight tracking; body 14 px/1.6 muted; privacy
  block 13 px on `--panel-soft`.
- Widget options: 10 px radius, 13×14 px padding, native checkboxes with accent color;
  title 12–13 px, description 11 px.
- Footer: separated by 1 px border, 16 px top padding, ghost skip left, actions right.
- No imagery, no widget previews, no animation between steps.

## 7. UX observations

1. **The brand mark is a placeholder-looking four-dot pattern**, inconsistent with the
   sidebar's more complex mark, and there is no product screenshot or visual promise.
   The page describes widgets rather than showing them.
2. **Step 2 is text-only checkboxes.** Users cannot see what the Clock/System/App grid
   look like, their size, or where they will appear; all three are preselected.
3. **"These three"** is inaccurate when a starter is unavailable; available starters
   are filtered silently.
4. **System copy mentions disk usage** that the widget does not display.
5. **AI step hardcodes Gemini** even though the AI tab supports Gemini, Groq,
   OpenRouter, Mistral, and Ollama. It also saves a key without testing or choosing a
   model, so the AI tab may still be unusable afterward.
6. **No theme/accents/wallpaper** step, even though “make Windows feel like yours” is
   the promise; the first impression is a default dark settings form.
7. **Skip setup is always visible** and bypasses all choices, including widget
   selection; it is not framed as “set up later” with a clear consequence.
8. **Footer Next is the only primary action**; Finish looks identical to Next, and
   saving has no progress indicator beyond a label change.
9. **No keyboard focus management** between steps; when the step content changes, focus
   may remain on the footer button, and screen readers are not notified of the new
   heading. Progress is aria-hidden and the step counter is plain text.
10. **No back/forward transitions**; the card swaps content abruptly.
11. **Onboarding blocks the entire app**, so a user who wants to explore settings must
    skip first.
12. **Completion is one-way**; no replay entry in settings.

## 8. Design brief for the AI

Make first-run feel like the product: visual, short, and confident.

- Replace the generic card with a branded onboarding surface (mark/wordmark, a real
  widget/wallpaper composition or screenshot, a subtle accent glow). Keep the compact
  window constraints.
- Step 1: one strong promise, three tiny proof points (offline widgets, approved
  network, encrypted keys), and a clear primary "Get started"; include "Skip for now"
  as a quiet secondary with honest consequences.
- Step 2: show **live previews** of Clock, System, and App grid (reuse `WidgetPreview`
  if `general` can be passed), with size labels and a simple select state. Preselect
  the recommended set but make deselection obvious. Explain that widgets appear on the
  desktop center.
- Step 3: keep AI optional, but either (a) keep it Gemini-only and say so, or (b)
  offer a provider choice consistent with the AI tab. Do not imply verification if
  none happens; add a "Test later in AI" note. Consider making this step skippable
  without hiding the key field behind a checkbox.
- Add a small theme/accent choice only if it can reuse existing `setTheme`/`setAccent`
  without new backend work; otherwise do not add a fake step.
- Use a proper stepper with labeled steps, focus management (`h2` focus on step change),
  `aria-live` announcements, and animated transitions that respect reduced motion.
- Keep the existing finish/skip contract: add only selected starters that do not
  already exist, save the Gemini key only if provided, then complete onboarding.

## 9. Output format

Return `Onboarding.tsx` + CSS scoped to `.onboarding-*`. If previews are added,
document the new prop and update `App.tsx`. Provide i18n keys and confirm keyboard and
reduced-motion behavior. No new dependencies.
