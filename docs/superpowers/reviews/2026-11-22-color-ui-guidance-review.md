# Color and UI guidance review

- **Status:** Read-only review, no code changed
- **Date:** 2026-11-22
- **Checkout:** `/home/hoalt/ghcr/kaneo` on branch `feature/modern-color-palette`
  @ `8260910a` (renamed from `import/design-astryx-ui-spike` after this review).
  Work happened on this branch only; the separate `design/astryx-ui-spike`
  worktree was never the one under review.
- **Scope:** web app color tokens, light/dark theming, browser-generated UI, focus
  and contrast
- **Guidance used:** modern-web-guidance `color`, `css`, `dark-mode`,
  `browser-ui-theming`, `accessibility`, `dark-mode-toggle`
- **Method:** token values read from the running dev instance
  (`http://localhost:5173`) with `getComputedStyle` in a Chromium preview, then
  converted to sRGB and measured with the WCAG relative-luminance formula.
  Alpha tokens were composited over their parent surface. Values in the tables
  are `measured ratio : required minimum`.

## 1. Summary

The color architecture is in better shape than most apps of this size: one
token file, semantic names, a real dark palette, `dark:` utilities that all key
off the same class, a system-theme listener that handles OS changes, and
reduced-motion handling. Text contrast on the primary paths is solid (15–17:1
for body text, 5:1 for muted text).

The problems cluster in four places:

1. **Browser-generated UI never follows the theme.** No `color-scheme` is
   declared, so scrollbars, native controls, and the initial canvas stay in the
   OS default. The guidance calls this mandatory and applies it to `:root`.
2. **The scrollbar is both too thin and too low-contrast.** `scrollbar-width:
   thin` is global and the thumb color is `--border` (1.2:1).
3. **Focus rings fail contrast in light mode and disappear in High Contrast.**
   They are 47 box-shadow `ring-2` usages with `outline-none` in 85 files and no
   `forced-colors` fallback.
4. **Metadata text on board cards fails AA.** Task IDs and completed titles sit
   at 2.5–3.45:1.

Plus one architecture debt that this review was asked to weigh: 44 raw hex
tokens for board/chip/avatar/priority bypass the semantic palette, so any future
palette or theme feature pays for them twice.

And one product-level observation, measured in §2: the chrome carries **no hue
at all** (0% chromatic background area, 0 of 62 chromatic text nodes on the
dashboard), because `--primary` and `--accent` are pure neutrals. That is why the
UI feels flat and why the requested "choose a color palette" option is the right
answer: the default should stay calm and unchanged, and an opt-in palette should
add one accent hue.

## 2. Color feel: why the UI reads as flat

Separate from contrast correctness: the palette has almost no hue in it, so the
product reads as "monochrome plus alerts" rather than as a product with its own
identity.

Measured on the running dashboard (`/dashboard/workspace/<id>`), sweeping every
visible element and reading its computed background and text color:

| Measure | Result |
| --- | --- |
| Chromatic background area (>0.04 OKLCH chroma) | **0%** of 4.7M px² of chrome |
| Chromatic background elements | **0 of 16** |
| Chromatic text nodes | **0 of 62** |

The tokens explain it:

- `--primary` is `neutral-800` in light and `neutral-100` in dark
  ([index.css](/home/hoalt/ghcr/kaneo/apps/web/src/index.css:260)). Every primary
  button, selected tab, switch, and checkbox is black or white — 69 usages, zero
  hue.
- `--accent` is black/white at 4% alpha. It backs 172 `bg-accent` hover surfaces,
  all grey.
- `--ring` is `neutral-400` in light and `neutral-500` in dark;
  `--sidebar-primary` is the same neutral as `--primary`.
- Hue exists only on status tokens, and only in small chips: `destructive` 132
  usages, `success` 45, `warning` 40, `info` 21, each `priority-*` 2, `due-overdue`
  1. Those mean "error / done / warning", not "Kaneo".
- `--chart-1..5` are the only genuinely saturated tokens in the file and are
  referenced **0 times** in `apps/web/src/**/*.tsx`; the chart scale is dead
  weight.
- The 44 raw-hex board/chip/avatar tokens are grey as well, apart from
  `priority-*` and `due-*`.

The effect: color arrives as an exception (an error, an overdue date, a
completed state), never as identity. The canvas is calm, which is good for a
task board, but nothing in the interface is *Kaneo's* — and nothing marks the
active, focused, or primary action beyond a change in lightness.

### 2.1 What a modern palette should add

Keep the neutral canvas and give it one accent hue, carried by the interactive
layer: primary, ring, selection, links/info, sidebar-active marker, charts. That
is the smallest change that removes the monotony without reintroducing noise on
the board.

This also shows the current palette spec is too timid: its modern `--primary` is
`oklch(0.25 0.03 265)`, chroma 0.03, which is still visually grey. Accent-forward
values that pass the same contrast gates (measured, hue 275):

| Token | Light | Ratio | Dark | Ratio |
| --- | --- | --- | --- | --- |
| `--primary` | `oklch(0.52 0.17 275)` | 5.62:1 vs `primary-foreground` | `oklch(0.75 0.14 275)` | 8.03:1 vs `primary-foreground` |
| `--primary-foreground` | `oklch(0.99 0.002 265)` | — | `oklch(0.19 0.009 265)` | — |
| `--ring` | `oklch(0.55 0.18 275)` | 4.89:1 vs background | `oklch(0.72 0.15 275)` | 7.58:1 vs background |
| `--accent-foreground` (link text) | `oklch(0.52 0.16 275)` | 5.52:1 vs background | `oklch(0.78 0.13 275)` | 9.37:1 vs background |
| text selection | bg `oklch(0.93 0.03 275)` / fg `oklch(0.30 0.06 275)` | 11.18:1 | inverted | — |

All pass 4.5:1 (text) and 3:1 (non-text). Nothing here changes the default
palette; it only defines what the opt-in one must look like. Contrast alone is
not the goal for this palette — if the result still measures 0% chromatic
chrome, the feature has not done its job.

## 3. Measured contrast

Light (`:root`):

| Pair | Ratio | Min | Result |
| --- | --- | --- | --- |
| foreground / background | 15.12 | 4.5 | pass |
| muted-foreground / background | 5.60 | 4.5 | pass |
| info-foreground / background | 6.82 | 4.5 | pass |
| success-foreground / background | 5.37 | 4.5 | pass |
| warning-foreground / background | 5.05 | 4.5 | pass |
| destructive-foreground / background | 6.42 | 4.5 | pass |
| sidebar-foreground / sidebar | 4.58 | 4.5 | pass (thin margin) |
| board-title / board-card | 17.93 | 4.5 | pass |
| chip-foreground / background | 10.37 | 4.5 | pass |
| **board-id / board-card** | **3.45** | 4.5 | **fail** |
| **board-id-done / board-card** | **2.52** | 4.5 | **fail** |
| **ring / background** | **2.59** | 3 | **fail** |
| input / background | 1.25 | 3 | fail (decorative or required, see F5) |
| chip-border / background | 1.22 | 3 | fail |
| board-card-border / board-card | 1.20 | 3 | fail |
| priority-low / board-card | 5.17 | 3 | pass |
| priority-medium / board-card | 3.19 | 3 | pass |
| priority-high / board-card | 3.56 | 3 | pass |
| priority-urgent / board-card | 4.83 | 3 | pass |

Dark (`.dark`):

| Pair | Ratio | Min | Result |
| --- | --- | --- | --- |
| foreground / background | 16.91 | 4.5 | pass |
| muted-foreground / background | 4.74 | 4.5 | pass |
| info-foreground / background | 7.00 | 4.5 | pass |
| success / warning / destructive foreground | 9.54 / 10.74 / 6.38 | 4.5 | pass |
| sidebar-foreground / sidebar | 7.47 | 4.5 | pass |
| board-title / board-card | 14.56 | 4.5 | pass |
| **board-id / board-card** | **3.44** | 4.5 | **fail** |
| **board-id-done / board-card** | **2.55** | 4.5 | **fail** |
| **board-title-done / board-card** | **3.44** | 4.5 | **fail** |
| ring / background | 3.90 | 3 | pass |
| input / background | 1.23 | 3 | fail |
| chip-border / background | 1.27 | 3 | fail |
| board-card-border / board-card | 1.00 (transparent by design) | 3 | n/a |

`--color-scheme` computed as `normal` in both modes, and there is no
`<meta name="color-scheme">`.

## 4. Findings

### F1 — No `color-scheme` on the root (High)

Guidance: "MANDATORY: Apply the `color-scheme` property to the `html` element or
the `:root` pseudo-class. Browsers specifically look to the root element to
determine the theme for the entire viewport—including the root scrollbars and
the initial 'canvas' background."

Kaneo sets `class="dark"` on `<html>` and restyles its own components, but never
tells the browser. Consequences: default scrollbars, date pickers, autofill
chrome, and the canvas behind the app stay light in dark mode; the canvas also
flashes white before the first paint.

Fix: `color-scheme: light` in `:root`, `color-scheme: dark` in `.dark`. The pin
is correct here because the scheme is already resolved in JS; do not use
`light dark` on `:root` unless the class-based resolution is removed.

### F2 — Scrollbar violates two explicit rules (High)

`apps/web/src/index.css:459-465` sets, globally:

```css
* { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
```

Guidance: "DON'T use the `scrollbar-width` with any value other than `auto`,
unless another accessible option is provided to scroll content… the target size
of the thumb will be too small for some users to operate." and "keep the thumb
visibly distinct from the track (contrast ≥3:1)".

Measured thumb contrast is 1.2:1 (light) and 1.16:1 (dark), against a
transparent track, so the thumb is effectively invisible on the page background.

Fix: drop `scrollbar-width: thin` from the universal selector (or scope it to
large non-primary scrollers), and use a dedicated `--scrollbar-thumb` token that
meets 3:1 against `--background` in both schemes. Keep the WebKit fallback after
the standard rule as the guidance describes.

### F3 — Focus indicators are shadow-only and fail contrast in light (High)

Evidence: 47 `focus-visible:ring-2` usages, `outline-none` in 85 files, only one
`focus-visible:outline-ring`. `--ring` is `neutral-400` in light mode, measured
2.59:1 against the page. Many rings are then applied at partial alpha
(`ring-ring/24`, `ring-ring/50`), which lowers it further.

Guidance: "Don't disable browser native focus indicators without providing a
replacement custom focus indicator" at "at least `3:1` against adjacent
content", "Prefer `outline` over other properties for focus rings", and "If
`box-shadow` must be relied on for focus rings, provide an `outline`-based
fallback for High Contrast Mode using the `forced-colors` media query."

Fix: darken the light `--ring` to at least 3:1 (for example neutral-600
territory), keep `outline: 2px solid var(--ring)` on `:focus-visible` instead of
only a shadow, and add the `forced-colors` outline fallback. This is the single
highest-value accessibility change in the app.

### F4 — Board metadata text fails AA (Medium)

`--board-id` 3.45/3.44, `--board-id-done` 2.52/2.55, and dark
`--board-title-done` 3.44 are all small text on cards, so 4.5:1 applies. The
completed-task de-emphasis is the intent; the values overshoot into
unreadability.

Fix: raise `--board-id` and `--board-title-done` to ≥4.5:1 in both schemes, and
express completion with the existing line-through plus a slightly lower weight
rather than a contrast cut below the threshold.

### F5 — UI boundaries sit near 1.2:1 (Medium)

`--input` (1.25 light / 1.23 dark), `--chip-border` (1.22 / 1.27), and
`--board-card-border` (1.20 light, transparent dark) do not meet the 3:1
non-text requirement. WCAG 1.4.11 applies to boundaries that are *needed to
identify* a control: form fields are the clear case, decorative card edges are
not.

The guidance also warns against over-applying: "Meeting 3:1 non-text contrast
can challenge minimalistic designs… Reach for `@media (prefers-contrast: more)`
when the design uses low-contrast accents… most sites that already meet baseline
contrast won't need it."

Fix: raise the input border specifically (a `--input` around 3:1, or a second
`--input-strong` used at rest for fields), and put the decorative borders behind
`@media (prefers-contrast: more)` rather than making the default UI heavier.
Do not rely on the inset shadow trick alone: shadows vanish in forced colors.

### F6 — No `forced-colors` support (Medium)

There is no `@media (forced-colors: active)` block anywhere in `index.css`.
Guidance: in Forced Colors Mode "the browser overrides author colors… removes
`box-shadow`, `text-shadow`, and gradient backgrounds", and "Define system color
fallbacks for color tokens".

Since Kaneo identifies several controls with shadows and 1px low-alpha borders
(buttons, inputs, chips, board cards), Windows High Contrast currently flattens
them into unlabeled boxes. Fix: map the structural tokens to system keywords
(`Canvas`, `CanvasText`, `ButtonText`, `Highlight`, `GrayText`) and keep an
`outline` for focus.

### F7 — 44 raw hex tokens bypass the palette (Medium, architecture)

`:root` and `.dark` mix two systems: tokens that reference Tailwind's palette
via `var(--color-*)`, and 44 literal hex values (`--board-*`, `--chip-*`,
`--avatar-*`, `--priority-*`, `--due-*`). The literals are already duplicated
light/dark and cannot be derived from a base scale, which is exactly why the
Modern palette proposal needed a second full value table for them.

Guidance: "Check for any existing conventions around naming and levels before
inventing your own" and "prefer variables over repetition". Fix: promote the
literal families onto a small primitive tier (ink, surface, line, accent) so a
palette swap only changes primitives. Do this before (or with) the palette work,
otherwise every future palette is 90 lines of duplicated hex.

### F8 — Theme has no first-paint bootstrap (Low)

`apps/web/index.html` has no bootstrap script, so the scheme class is applied
in a React effect ([theme-provider](/home/hoalt/ghcr/kaneo/apps/web/src/components/providers/theme-provider/index.tsx:7)).
The guidance's toggle pattern places a small inline script right after the
`color-scheme` meta specifically to avoid a flash of the wrong scheme. Adding
one also fixes the light flash for dark-mode users today.

### F9 — `prefers-contrast` is unused (Low)

Same guidance line as F5. Kaneo's aesthetic depends on low-contrast borders, so
the opt-in path is the honest fix: keep the default, strengthen `--border`,
`--input`, `--chip-border`, and `--board-card-border` under `prefers-contrast:
more`.

### F10 — Details that ignore the scheme (Low)

The embed blocks hardcode `background: black` for iframes
([index.css](/home/hoalt/ghcr/kaneo/apps/web/src/index.css:1081)), and
`--board-lane` is a fixed black alpha in both schemes. Minor, but these are the
spots that look wrong first when the scheme flips.

## 5. What is already good

- System theme: `matchMedia` plus a `change` listener, exactly what the guidance
  requires ("Any JS reading `matchMedia(...)` MUST also handle its `change`
  event").
- Semantic naming is consistent; components use tokens (only 4 hardcoded
  Tailwind palette utilities outside the preview components).
- Status is not color-only: priorities have glyphs and bars, the overdue chip
  renders the words ("2 days overdue"), and status chips carry text.
- `:focus-visible` is used consistently, never bare `:focus`, and the outline
  color token is present even where the ring is a shadow.
- Reduced motion is handled globally for popups, sidebars, toasts, and dnd.
- Destructive/info/success/warning foregrounds all pass 4.5:1 in both schemes.
- Dialogs and menus use Base UI/Radix primitives with real focus management.

## 6. Recommended order

| # | Change | Effort | Why first |
| --- | --- | --- | --- |
| 1 | `color-scheme` on `:root` / `.dark` | 2 lines | Fixes native UI and canvas flash for every user |
| 2 | `--ring` ≥3:1 + outline-based focus + forced-colors fallback | small | Highest accessibility impact |
| 3 | Scrollbar: drop global `thin`, dedicated thumb token ≥3:1 | small | Explicit guidance violation, visible daily |
| 4 | Board metadata contrast (`--board-id*`, `--board-title-done`) | value-only | Real AA failures on the main screen |
| 5 | `prefers-contrast: more` for input/chip/card borders | small | Keeps the aesthetic, adds the accessible path |
| 6 | First-paint bootstrap (meta + inline script) | small | Removes the flash, cheap |
| 7 | Token consolidation of the 44 hex literals | medium | Prerequisite for any palette/theme feature |
| 8 | `forced-colors` token mapping | small | Windows High Contrast correctness |
| 9 | Opt-in accent-forward Modern palette + palette picker | medium | Answers the "flat, no accent" feedback without touching the default palette |

Items 1, 2, 3, 6 and 8 overlap the polish phase already sketched in
[the palette spec](/home/hoalt/ghcr/kaneo/docs/superpowers/specs/2026-11-22-modern-color-palette-design.md).
Item 7 is the piece that spec assumes but does not do; doing it first makes the
Modern palette roughly half its current size. Item 9 is the user-visible goal:
an opt-in palette that actually carries an accent (§2.1), with the picker living
in Preferences next to the theme choice.

## 7. Caveats

- Ratios come from computed values on one page state (dashboard shell). A
  component that applies partial alpha to a token (for example `bg-border/50`)
  measures lower than the token-to-background number listed here.
- `board-card-border` is transparent in dark mode by design, not an oversight;
  it is listed as `n/a` rather than a failure.
- The 3:1 border requirement is scoped to boundaries that identify a control;
  card and lane edges are aesthetic unless the UI relies on them to locate the
  control. Judgement is needed per surface, which is why F5 recommends the
  `prefers-contrast` path instead of a blanket change.
- This review is read-only: nothing in `apps/web` was modified. The palette
  store changes started earlier on this branch were reverted.