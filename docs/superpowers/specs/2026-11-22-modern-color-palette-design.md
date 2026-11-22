# Modern OKLCH color palette — design spec

- **Status:** Draft for approval
- **Date:** 2026-11-22
- **Branch:** `feature/modern-color-palette`
- **Area:** web (design tokens, preferences UI, i18n, tests)
- **Related guidance:** modern-web-guidance `color`, `css`, `dark-mode-toggle`

## 1. Intent

Kaneo's UI ships one color palette: neutral greys for structure, Tailwind's
default palette for status colors, and a long list of hand-written hex values for
board, chip, priority, and avatar tokens. It looks deliberate in both light and
dark, and it must keep looking that way.

This spec adds a **second, opt-in palette authored in OKLCH** and a preference
that switches between them. The existing palette stays the default and its CSS
stays byte-for-byte unchanged. Nothing changes for a user who never opens the
setting.

Why OKLCH: identical lightness steps look identical across hues, so status
colors (info, success, warning, destructive, priorities) can share one perceived
lightness scale instead of the current mix of Tailwind-500 values that drift in
contrast between light and dark mode. Perceptually even neutrals also let the
modern palette carry a subtle cool cast without turning text muddy.

Why an accent and why opt-in: a measurement of the running app found the chrome
contains **no hue at all** — 0% chromatic background area and 0 of 62 chromatic
text nodes on the dashboard
([review §2](/home/hoalt/ghcr/kaneo/docs/superpowers/reviews/2026-11-22-color-ui-guidance-review.md)).
The default palette is calm on purpose and must not change, but it leaves the
product without identity. The modern palette therefore carries one accent hue on
the interactive layer (primary, ring, links, selection, active sidebar item)
while keeping the canvas neutral.

## 2. Baseline: how color works today

All tokens live in `apps/web/src/index.css`:

| Layer | Where | Notes |
| --- | --- | --- |
| Tailwind mapping | `@theme inline` (line ~117) | Maps `--color-*` utilities (`bg-background`, `text-muted-foreground`, …) onto CSS variables. No values here. |
| Light values | `:root` (line ~226) | ~60 semantic tokens. Most reference Tailwind's `--color-neutral-*`, `--color-red-*`, … through `var()`; board/chip/priority/avatar tokens are raw hex. |
| Dark values | `.dark` (line ~339) | Same token names, redefined. `--background` and friends use `color-mix(in srgb, …)`. |
| Dark variant | `@custom-variant dark (&:is(.dark *))` | Every `dark:` utility keys off an ancestor `.dark`. |

Runtime plumbing:

- `apps/web/src/store/user-preferences.ts` — zustand store persisted in
  `localStorage` under `user-preferences`; `theme: "light" | "dark" | "system"`,
  default `"dark"`. Adding a field here is backward compatible because zustand's
  default merge keeps store defaults for missing keys.
- `apps/web/src/components/providers/theme-provider/index.tsx` — one effect adds
  `light` or `dark` to `<html>`, resolves `system` with `matchMedia`, and listens
  for OS changes.
- `apps/web/src/components/settings/preferences/preferences-page.tsx` — the
  Preferences settings page: a `Theme` section with `ThemePicker`, then
  `GeneralPreferencesSection` rows (`PriorityIconsRow` is the closest pattern:
  a `ToggleGroup` with inline previews).
- `apps/web/src/components/account/theme-preview-window.tsx` — fixed-color
  thumbnail; intentionally does not use tokens so each option previews itself.
- `apps/web/index.html` — no theme bootstrap script; the class is applied in
  `useEffect`, so the first paint already has a flash of the wrong scheme.

Things that look palette-aware but are not:

- `apps/web/src/components/task/extensions/shiki-code-block.ts` and
  `mermaid-block.ts` read `documentElement.classList.contains("dark")`. They
  follow the scheme only; palettes must not change that check.
- `apps/mobile` has its own theme layer in Expo. Out of scope here.
- `apps/site` (Next.js) and `apps/docs` (Mintlify) have their own styles. Out of
  scope.

## 3. Goals

1. A user can pick **Modern (OKLCH)** in Preferences → appearance, alongside the
   existing theme choice (light / dark / match system).
2. **Kaneo** remains the default; a user who never touches the setting sees the
   current pixels and the current CSS.
3. The modern palette covers **every** token the UI reads, in both schemes,
   including the raw-hex board/chip/priority/avatar tokens, so no component is
   left half-themed.
4. Text tokens meet WCAG AA (4.5:1) and focus/status non-text tokens meet 3:1 in
   both schemes; a test enforces this so future token edits cannot silently
   regress.
5. Adding a token to the base palette without adding it to the modern palette
   fails a test.
6. The modern palette carries a **real accent hue**, not a near-grey primary.
   Kaneo's chrome measures 0% chromatic background area today (see
   [the review](/home/hoalt/ghcr/kaneo/docs/superpowers/reviews/2026-11-22-color-ui-guidance-review.md)
   §2); the opt-in palette exists precisely to add identity without touching the
   default. Accent authority: `--primary`, `--ring`, `--accent-foreground`,
   `--sidebar-primary`, `--sidebar-ring`, the active-sidebar gradient, and the
   selected-card tint. A contrast test is necessary but not sufficient — the
   modern `--primary` must keep chroma ≥0.12.

## 4. Non-goals

- No theme marketplace, no per-workspace/instance theme, no user-supplied colors.
- No server-side sync of appearance preferences (theme is already local-only;
  syncing is a separate feature).
- No mobile implementation in this pass.
- No change to the default palette's values, naming, or the `@theme inline`
  mapping.
- No `light-dark()` migration of the existing tokens (see approach B).

## 5. Anti-goals

- The modern palette must not be a tint applied by a filter or `opacity`; it must
  be real values, or screenshots and contrast checks become meaningless.
- The setting must not be a segmented control in the app chrome. Theme and
  palette are long-term preferences; the guidance is explicit that they belong
  in a settings surface, which Kaneo already has.
- Do not generate tints at runtime by shifting the `oklch` lightness channel.
  Browsers do not gamut-map consistently there; author literal tokens instead.

## 6. Approaches considered

**A. Additive palette layer with `data-palette` (chosen).** Keep `:root` and
`.dark` untouched. Add one block for light and one for dark, scoped to
`:root[data-palette="modern"]` and `:root.dark[data-palette="modern"]`, that
redeclare the same token names with OKLCH values. The provider writes
`data-palette` next to the scheme class.

- Cost: ~60 declarations per scheme, mechanical.
- Risk: low, because the default path is no CSS. A parity test catches drift.
- Trade-off: token values are duplicated per palette. Acceptable for two
  hand-authored palettes; it is the same model shadcn-based projects use.

**B. Rewrite base tokens on `light-dark()` and layer palettes on primitives.**
One primitive tier, semantic tier using `light-dark()`, palette blocks swapping
primitives.

- Better long-term architecture and less duplication.
- But it changes every existing token, the dark variant, and the
  `class="dark"` plumbing that shiki, mermaid, and the public-project toggle
  depend on. A regression here is visible everywhere.
- Rejected for this pass; A can migrate to it later without changing the UI or
  the stored preference value.

**C. Theme registry with several named palettes loaded as presets.** Most
flexible, adds previews and future palettes.

- No user need yet; doubles the design and test surface.
- Rejected, but A's `palette` field is a string union so adding ids later is
  additive.

**D. Persist the palette on the user record (API + migration).** Rejected:
inconsistent with `theme`, needs migration and mobile/CLI follow-through, and
solves multi-device sync rather than the requested choice.

## 7. Design

### 7.1 Stored preference

In `user-preferences.ts`:

```ts
export type ColorPalette = "kaneo" | "modern";

// store
palette: ColorPalette;              // default "kaneo"
setPalette: (palette: ColorPalette) => void;
```

`onRehydrateStorage` normalizes an unknown stored value (older builds, hand-edited
`localStorage`) to `"kaneo"`, the same way `weekStartsOn` is normalized today.

`setPalette` follows `setTheme`'s `startViewTransition` pattern? **No.** A
palette swap repaints far more surface than a scheme swap; wrap it in the same
transition only if it feels good in review. Default to a plain `set()` and treat
the transition as a polish decision during implementation (`document.startViewTransition`
already exists in `setTheme`, so it is one line to try).

### 7.2 Applying it

`ThemeProvider` stays the single writer of appearance state on `<html>`:

```ts
root.classList.toggle("dark", resolved === "dark");  // resolved from theme
root.dataset.palette = palette === "modern" ? "modern" : "";  // or delete
```

- Default palette sets no attribute, so the default path is exactly today's DOM.
- The `system` scheme listener keeps working unchanged; palette is orthogonal.
- Keep `data-palette` on `documentElement`, not `body`, so `@theme` and any
  future component-scoped themes see it.

### 7.3 CSS blocks

Inserted after the `.dark` block so specificity plus source order both win.
`:root.dark[data-palette="modern"]` (0,3,1) beats `.dark` (0,1,1).

```css
/* Modern OKLCH palette. Opt-in: [data-palette="modern"] on <html>.
   Hue 265 is the neutral cast; 275 is the focus/ring accent. */
:root[data-palette="modern"] {
  --background: oklch(0.985 0.004 265);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.28 0.015 265);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.28 0.015 265);
  --foreground: oklch(0.22 0.015 265);
  --muted: oklch(0.22 0.015 265 / 0.04);
  --muted-foreground: oklch(0.50 0.015 265);
  --accent: oklch(0.52 0.17 275 / 0.06);
  --accent-foreground: oklch(0.52 0.16 275);
  --secondary: oklch(0.22 0.015 265 / 0.05);
  --secondary-foreground: oklch(0.25 0.02 265);
  --border: oklch(0.22 0.015 265 / 0.10);
  --input: oklch(0.22 0.015 265 / 0.12);
  --ring: oklch(0.55 0.18 275);
  --primary: oklch(0.52 0.17 275);
  --primary-foreground: oklch(0.99 0.002 265);
  --destructive: oklch(0.58 0.21 22);
  --destructive-foreground: oklch(0.45 0.19 22);
  --success: oklch(0.62 0.14 160);
  --success-foreground: oklch(0.45 0.12 160);
  --warning: oklch(0.75 0.15 75);
  --warning-foreground: oklch(0.50 0.13 70);
  --info: oklch(0.60 0.16 255);
  --info-foreground: oklch(0.48 0.15 258);
  --chart-1: oklch(0.62 0.19 35);
  --chart-2: oklch(0.60 0.12 180);
  --chart-3: oklch(0.45 0.09 240);
  --chart-4: oklch(0.78 0.15 85);
  --chart-5: oklch(0.72 0.16 70);
  --sidebar: oklch(0.972 0.005 265);
  --sidebar-foreground: oklch(0.38 0.015 265);
  --sidebar-primary: oklch(0.52 0.17 275);
  --sidebar-primary-foreground: oklch(0.99 0.002 265);
  --sidebar-accent: oklch(0.22 0.015 265 / 0.05);
  --sidebar-accent-foreground: oklch(0.25 0.02 265);
  --sidebar-border: oklch(0.22 0.015 265 / 0.07);
  --sidebar-ring: oklch(0.55 0.18 275);
  --sidebar-active: linear-gradient(to bottom, oklch(1 0 0), oklch(0.95 0.02 275));
  --sidebar-active-shadow:
    inset 0 1px 0 oklch(1 0 0),
    0 0 0 1px oklch(0.25 0.02 265 / 0.08),
    0 1px 2px oklch(0.25 0.02 265 / 0.06),
    0 2px 6px oklch(0.25 0.02 265 / 0.03);
  --code: oklch(1 0 0);
  --code-foreground: oklch(0.22 0.015 265);
  --code-highlight: oklch(0.22 0.015 265 / 0.05);
  --board-lane: oklch(0.30 0.02 265 / 0.03);
  --board-card: oklch(1 0 0);
  --board-card-border: oklch(0.25 0.02 265 / 0.09);
  --board-card-border-hover: oklch(0.25 0.02 265 / 0.20);
  --board-card-selected: oklch(0.95 0.02 275);
  --board-card-selected-border: oklch(0.25 0.02 265 / 0.25);
  --board-card-focus: oklch(0.58 0.02 265);
  --board-card-ring: oklch(0.55 0.18 275 / 0.25);
  --board-card-shadow: 0 1px 2px oklch(0.25 0.02 265 / 0.04);
  --board-card-done: oklch(1 0 0 / 0.60);
  --board-card-done-border: oklch(0.25 0.02 265 / 0.06);
  --board-id: oklch(0.58 0.02 265);
  --board-id-done: oklch(0.68 0.015 265);
  --board-title: oklch(0.22 0.015 265);
  --board-title-done: oklch(0.52 0.015 265);
  --chip-border: oklch(0.25 0.02 265 / 0.10);
  --chip-border-hover: oklch(0.25 0.02 265 / 0.18);
  --chip-hover: oklch(0.25 0.02 265 / 0.04);
  --chip-border-open: oklch(0.25 0.02 265 / 0.22);
  --chip-open: oklch(0.25 0.02 265 / 0.06);
  --chip-foreground: oklch(0.30 0.015 265);
  --chip-muted: oklch(0.50 0.015 265);
  --chip-icon: oklch(0.58 0.02 265);
  --priority-bar: oklch(0.42 0.02 265);
  --priority-bar-empty: oklch(0.25 0.02 265 / 0.14);
  --priority-low: oklch(0.55 0.19 255);
  --priority-medium: oklch(0.65 0.15 65);
  --priority-high: oklch(0.62 0.19 45);
  --priority-urgent: oklch(0.58 0.21 22);
  --due-overdue: oklch(0.55 0.21 22);
  --avatar: oklch(0.93 0.01 265);
  --avatar-selected: oklch(0.90 0.012 265);
  --avatar-done: oklch(0.95 0.008 265);
  --avatar-border: oklch(0.25 0.02 265 / 0.10);
  --avatar-foreground: oklch(0.32 0.015 265);
  --avatar-foreground-done: oklch(0.52 0.015 265);
  --avatar-unassigned: oklch(0.965 0.006 265);
  --avatar-unassigned-foreground: oklch(0.58 0.02 265);
}

:root.dark[data-palette="modern"] {
  --background: oklch(0.16 0.008 265);
  --card: oklch(0.19 0.009 265);
  --card-foreground: oklch(0.94 0.006 265);
  --popover: oklch(0.20 0.009 265);
  --popover-foreground: oklch(0.94 0.006 265);
  --foreground: oklch(0.94 0.006 265);
  --muted: oklch(1 0 0 / 0.045);
  --muted-foreground: oklch(0.68 0.012 265);
  --accent: oklch(0.72 0.15 275 / 0.10);
  --accent-foreground: oklch(0.78 0.13 275);
  --secondary: oklch(1 0 0 / 0.05);
  --secondary-foreground: oklch(0.95 0.005 265);
  --border: oklch(1 0 0 / 0.07);
  --input: oklch(1 0 0 / 0.10);
  --ring: oklch(0.72 0.15 275);
  --primary: oklch(0.75 0.14 275);
  --primary-foreground: oklch(0.19 0.009 265);
  --destructive: oklch(0.66 0.19 22);
  --destructive-foreground: oklch(0.72 0.16 22);
  --success: oklch(0.70 0.14 160);
  --success-foreground: oklch(0.76 0.12 160);
  --warning: oklch(0.78 0.14 75);
  --warning-foreground: oklch(0.82 0.12 75);
  --info: oklch(0.68 0.16 255);
  --info-foreground: oklch(0.78 0.12 258);
  --chart-1: oklch(0.70 0.17 35);
  --chart-2: oklch(0.72 0.13 180);
  --chart-3: oklch(0.66 0.12 240);
  --chart-4: oklch(0.76 0.14 85);
  --chart-5: oklch(0.72 0.16 70);
  --sidebar: oklch(0.145 0.008 265);
  --sidebar-foreground: oklch(0.72 0.012 265);
  --sidebar-primary: oklch(0.75 0.14 275);
  --sidebar-primary-foreground: oklch(0.19 0.009 265);
  --sidebar-accent: oklch(1 0 0 / 0.05);
  --sidebar-accent-foreground: oklch(0.95 0.005 265);
  --sidebar-border: oklch(1 0 0 / 0.06);
  --sidebar-ring: oklch(0.72 0.15 275);
  --sidebar-active: linear-gradient(to bottom, oklch(0.72 0.15 275 / 0.16), oklch(0.72 0.15 275 / 0.08));
  --sidebar-active-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.08),
    0 0 0 1px oklch(1 0 0 / 0.06),
    0 1px 2px oklch(0 0 0 / 0.40);
  --code: oklch(0.20 0.009 265);
  --code-foreground: oklch(0.94 0.006 265);
  --code-highlight: oklch(1 0 0 / 0.05);
  --board-lane: oklch(0 0 0 / 0.12);
  --board-card: oklch(0.21 0.009 265);
  --board-card-border: transparent;
  --board-card-border-hover: oklch(1 0 0 / 0.18);
  --board-card-selected: oklch(0.26 0.02 275);
  --board-card-selected-border: oklch(1 0 0 / 0.24);
  --board-card-focus: oklch(0.72 0.02 265);
  --board-card-ring: oklch(0.72 0.15 275 / 0.30);
  --board-card-shadow:
    0 1px 2px oklch(0 0 0 / 0.20),
    0 4px 12px -4px oklch(0 0 0 / 0.35);
  --board-card-done: oklch(1 0 0 / 0.01);
  --board-card-done-border: oklch(1 0 0 / 0.04);
  --board-id: oklch(0.66 0.02 265);
  --board-id-done: oklch(0.52 0.015 265);
  --board-title: oklch(0.93 0.006 265);
  --board-title-done: oklch(0.55 0.015 265);
  --chip-border: oklch(1 0 0 / 0.09);
  --chip-border-hover: oklch(1 0 0 / 0.16);
  --chip-hover: oklch(1 0 0 / 0.04);
  --chip-border-open: oklch(1 0 0 / 0.20);
  --chip-open: oklch(1 0 0 / 0.06);
  --chip-foreground: oklch(0.81 0.012 265);
  --chip-muted: oklch(0.60 0.012 265);
  --chip-icon: oklch(0.66 0.02 265);
  --priority-bar: oklch(0.64 0.02 265);
  --priority-bar-empty: oklch(1 0 0 / 0.14);
  --priority-low: oklch(0.70 0.15 255);
  --priority-medium: oklch(0.78 0.14 75);
  --priority-high: oklch(0.72 0.17 45);
  --priority-urgent: oklch(0.66 0.19 22);
  --due-overdue: oklch(0.72 0.18 22);
  --avatar: oklch(0.26 0.01 265);
  --avatar-selected: oklch(0.30 0.012 265);
  --avatar-done: oklch(0.22 0.008 265);
  --avatar-border: oklch(1 0 0 / 0.09);
  --avatar-foreground: oklch(0.83 0.012 265);
  --avatar-foreground-done: oklch(0.55 0.015 265);
  --avatar-unassigned: oklch(0.24 0.008 265);
  --avatar-unassigned-foreground: oklch(0.66 0.02 265);
}
```

Notes for the implementer:

- These are **starting values**. Run the contrast test below; if a pair fails,
  move the lightness (L) of the lighter/darker side, never the hue. Keep the
  measured ratios in a comment next to the block once final.
- Do not use `color-mix(in oklch, …)` with white/black to make hover/disabled
  variants of these tokens. Guidance flags a Chromium bug where low-chroma
  `oklch` colors get a powerless hue and mix toward pink. Existing components
  already use `color-mix(in srgb, …)` or `oklab`; leave them.
- `--font-*`, `--radius`, and the `--ease-*` values stay out of the palette
  blocks. Only color tokens are palette-scoped.
- Accent values above are measured: light `--primary` 5.62:1 against
  `--primary-foreground`, dark 8.03:1; light `--ring` 4.89:1 and dark 7.58:1
  against `--background`; accent link text 5.52:1 light / 9.37:1 dark. Keep the
  hue (275) fixed and tune lightness only. If a future edit drives `--primary`
  chroma below 0.12 it is no longer an accent palette — the §9 test fails on it
  deliberately.

### 7.4 Settings UI

Add a **Palette** row under the existing Theme section in
`preferences-page.tsx`:

```
Theme     [Light] [Dark] [Match system]
Palette   [Kaneo (default)] [Modern (OKLCH)]
```

- New component `apps/web/src/components/settings/preferences/palette-row.tsx`,
  using `SettingsRow` (stacked) plus a `RadioGroup` of two cards, mirroring
  `ThemePicker`'s accessible structure (`RadioPrimitive.Root`, `aria-label`,
  `data-checked` ring) rather than a plain button pair.
- Each card shows `ThemePreviewWindow` (light and dark side by side, like the
  `system` theme card) with a palette swatch strip: background, card, border,
  text, accent, primary. Swatches use fixed literal colors so an option previews
  itself regardless of the active palette — the same reason
  `ThemePreviewWindow` avoids tokens.
- Card labels: "Kaneo" and "Modern", each with a one-line description
  ("Kaneo's original neutral palette", "Cool neutrals with perceptually even
  OKLCH accents").
- Keep the setting above the fold with the theme choice; it is the same kind of
  long-term appearance decision, and the guidance puts both in a settings
  surface, not in app chrome.

### 7.5 i18n

Add under `settings.preferencesPage` in `i18n/en-US.json` (source of truth):

```json
"palette": "Palette",
"paletteDescription": "The colors Kaneo uses. Theme still controls light and dark.",
"paletteKaneo": "Kaneo",
"paletteKaneoDescription": "The original neutral palette.",
"paletteModern": "Modern",
"paletteModernDescription": "Cool neutrals with even OKLCH accents.",
"selectPalette": "Select a color palette"
```

Then run `pnpm i18n:schema` and `pnpm i18n:check:fix` so other locales get
placeholders from the schema, not hand-written guesses.

### 7.6 Polish included in the same change (phase 2, same PR if cheap)

These are small, independently reviewable improvements that the color guidance
calls for and that the palette work exposes:

1. **`color-scheme`**: add `color-scheme: light` to `:root` and
   `color-scheme: dark` to `.dark`. Native controls, scrollbars, and form widgets
   currently do not follow Kaneo's dark mode. This also makes `oklch` `<input>`
   autofill behave. No palette-specific work: both palettes are light or dark.
2. **FOUC bootstrap**: a ~8-line inline script in `apps/web/index.html` after
   the `<head>` metadata reads `localStorage["user-preferences"]`, parses
   `state.theme` and `state.palette`, and applies the class/attribute before
   first paint. Wrap in `try/catch`; when storage is unavailable the app still
   boots with defaults. This fixes the existing flash for the default theme too,
   so it is not palette-only.
3. **`prefers-contrast: more`**: strengthen `--border`, `--input`, and
   `--chip-border` in both palettes to ≥3:1. Neither palette meets 3:1 for
   borders by default; that is a deliberate aesthetic choice today, and this is
   the opt-in path that does not make the default UI heavier.
4. **`forced-colors: active`**: remap `--foreground`, `--background`,
   `--card`, `--border`, `--primary`, and the focus/ring tokens to system
   keywords (`CanvasText`, `Canvas`, `ButtonText`, `GrayText`, `Highlight`).
   Without it, Windows High Contrast drops the oklch colors to defaults while
   Kaneo's layered shadows disappear, which can leave boundaries unreadable.

## 8. Follow-through surfaces

| Surface | Effect |
| --- | --- |
| Preferences page | New palette row; autosave note already covers it. |
| Public project view (`components/public-project`) | Uses the same tokens and `ThemeProvider`? Verify: its `theme-toggle.tsx` calls `setTheme`, so it inherits the palette. No separate work. |
| Auth / onboarding / boot frame | Token-based; palette applies automatically. |
| Command palette (`components/command-palette`) | Uses `setTheme`; add no palette action. |
| Shiki/Mermaid | Keyed on `.dark`; palette must not touch that check. |
| Mobile app | Non-goal; note in `apps/mobile/AGENTS.md` follow-up if the palette ships. |
| Docs / site | Non-goal. |

## 9. Testing

1. **Token parity** (`apps/web/src/lib/color/palette-tokens.test.ts`):
   parse `index.css`, collect `--token:` names in `:root`, in `.dark`, in
   `:root[data-palette="modern"]`, and in `:root.dark[data-palette="modern"]`
   (minus `--font-*`, `--radius`, `--ease-*`). Assert the modern blocks cover
   every base color token, and modern dark covers both base `.dark` and modern
   light.
2. **Contrast** (`palette-contrast.test.ts`): parse `oklch()` values from the two
   modern blocks, convert via the sRGB matrix, assert:
   - `foreground` / `background`, `foreground` / `card`, `muted-foreground` /
     `background`, each `*-foreground` / `background`, `board-title` /
     `board-card`, `chip-foreground` / `background` ≥ 4.5;
   - `ring` / `background`, `board-card-focus` / `board-card`,
     `priority-*` / `background` ≥ 3.
   Report the measured ratios in the failure message so tuning is mechanical.
   **Known exceptions** (intentional, measured against `background` or the
   owning surface): `--warning` light is 2.18:1 as an alert icon (kaneo 1.52),
   `--board-id` light 4.29:1 (kaneo 3.45), `--avatar-unassigned-foreground`
   light 3.87:1 (kaneo 3.17), and the `*-done` tokens stay dim on purpose:
   `--board-id-done` 2.88/3.22 (kaneo 2.52/2.55), `--board-title-done` dark
   3.65 (kaneo 3.44), `--avatar-foreground-done` dark 3.57 (kaneo 3.21). Each
   is at or above its kaneo equivalent, so the palette never regresses; raising
   them would flatten the done state rather than fix a defect.
2b. **Accent presence** (same file): assert the modern `--primary` and
    `--ring` have OKLCH chroma ≥ 0.12 and the hue is within 10° of 275 in both
    schemes. This is the guard that keeps the palette from drifting back to
    grey — contrast alone would let a `C 0.03` primary pass.
3. **Store test**: default is `"kaneo"`; `setPalette("modern")` persists; an
   unknown stored value normalizes to `"kaneo"` on rehydrate.
4. **UI test**: `palette-row.test.tsx` — two radio options, accessible labels,
   selection calls the setter, check icon on the selected option only.
5. **Browser check** (manual, both palettes × light/dark): Preferences page,
   board with many cards, task detail with description/checklist/comments,
   command palette, a dialog, the sidebar, and the public project page. Watch
   for any token still resolving to a Tailwind grey (the half-themed symptom).
   Repeat the §2 sweep on the dashboard with the modern palette active: the
   chromatic background-area share must be clearly above 0% (the accent appears
   on buttons, focus, selection, active navigation), while the board canvas
   itself should stay near neutral so task scanning stays calm.

Commands: `pnpm --filter @kaneo/web typecheck`, targeted
`pnpm exec vp test run <file>`, `pnpm lint`, `pnpm i18n:check`. Run
`pnpm test` if the store/provider change spills outside `apps/web`.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| A token is added later and forgotten in the modern block | Parity test fails in CI. |
| Contrast drifts on a hand-tuned value | Contrast test computes the ratio, not a hardcoded claim. |
| OKLCH unsupported in an old browser | All target browsers are Baseline for `oklch()`; if a custom support policy appears, add a hex fallback declaration before each `oklch()` value. |
| Theme/palette flash gets worse | Inline bootstrap in phase 2, applied before paint. |
| Reviewers think the default changed | Default path adds no attribute and no CSS values; diff to `:root`/`.dark` must be empty except inserted blocks. |

## 11. Implementation order

1. Store field + normalization + tests.
2. Palette CSS blocks + parity and contrast tests.
3. Provider writes `data-palette`; verify both schemes with the store forced.
4. Palette row UI + preview swatches + i18n + UI test.
5. Phase 2 polish (`color-scheme`, FOUC script, `prefers-contrast`,
   `forced-colors`) as separate commits.
6. Browser pass, then `pnpm lint`, `pnpm typecheck`, targeted tests.

## 12. Open decision

Everything above assumes a single additional palette: **Modern**. If more than
one modern variant is wanted (for example a warm variant), the mechanism stays
the same and the `ColorPalette` union grows; the palette row becomes a list. That
is a scope decision for the reviewer, not a change to the design.
