# Modern OKLCH palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in OKLCH color palette that users pick in Preferences while keeping Kaneo's existing palette as the untouched default.

**Architecture:** The palette is an additive CSS layer scoped to `[data-palette="modern"]` on `<html>`, plus one `palette` field in the existing localStorage preference store. `ThemeProvider` writes the attribute; a settings row writes the store. No API, database, or default-CSS changes.

**Tech Stack:** React 19, zustand + persist, Tailwind v4 CSS variables, Base UI radio primitives, vite-plus test runner, i18next.

**Spec:** `docs/superpowers/specs/2026-11-22-modern-color-palette-design.md`

## Global Constraints

- Default palette is `"kaneo"`; `:root` and `.dark` blocks must not change values.
- Only color tokens are palette-scoped; `--font-*`, `--radius`, `--ease-*` are not.
- All user-facing copy goes in `i18n/en-US.json` under `settings.preferencesPage`, with `i18n/schema.json` regenerated.
- Tests live next to the code they cover and use `vite-plus/test`.
- New source files hold one responsibility; pure helpers go in their own module.
- Do not commit, push, or open a PR unless asked.

## Review Focus

- A user whose stored `user-preferences` predates this change still gets Kaneo colors, not a broken/undefined attribute.
- A hand-edited `palette` value (e.g. `"neon"`) falls back to Kaneo without throwing.
- With theme `system`, changing the OS scheme changes only the class, never clears the palette.
- Adding a color token to `:root` later without adding it to the modern blocks fails a test, not production.
- Pages rendered outside the settings surface (auth, public project) inherit the palette with no extra wiring.
- The FOUC script with blocked `localStorage` leaves the app booting on defaults.

---

### Task 1: Palette preference value

**Files:**
- Create: `apps/web/src/store/color-palette.ts`
- Create: `apps/web/src/store/color-palette.test.ts`
- Modify: `apps/web/src/store/user-preferences.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `COLOR_PALETTES: readonly ["kaneo", "modern"]`, `type ColorPalette = "kaneo" | "modern"`, `isColorPalette(value: unknown): value is ColorPalette`, `normalizePalette(value: unknown): ColorPalette`. Store adds `palette: ColorPalette` and `setPalette(palette: ColorPalette): void`.

- [ ] **Step 1: Write the failing test** in `color-palette.test.ts`

```ts
import { describe, expect, it } from "vite-plus/test";
import { isColorPalette, normalizePalette } from "./color-palette";

describe("color palette preference", () => {
  it("accepts the two known palettes", () => {
    expect(isColorPalette("kaneo")).toBe(true);
    expect(isColorPalette("modern")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isColorPalette("neon")).toBe(false);
    expect(isColorPalette(undefined)).toBe(false);
  });

  it("falls back to kaneo for stored garbage", () => {
    expect(normalizePalette("neon")).toBe("kaneo");
    expect(normalizePalette(null)).toBe("kaneo");
    expect(normalizePalette("modern")).toBe("modern");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @kaneo/web exec vp test run src/store/color-palette.test.ts`
Expected: FAIL — cannot resolve `./color-palette`.

- [ ] **Step 3: Implement `color-palette.ts`**

```ts
export const COLOR_PALETTES = ["kaneo", "modern"] as const;

export type ColorPalette = (typeof COLOR_PALETTES)[number];

export function isColorPalette(value: unknown): value is ColorPalette {
  return COLOR_PALETTES.some((palette) => palette === value);
}

export function normalizePalette(value: unknown): ColorPalette {
  return isColorPalette(value) ? value : "kaneo";
}
```

- [ ] **Step 4: Wire the store**

In `user-preferences.ts`: import `normalizePalette` and `type ColorPalette`; add `palette: ColorPalette` and `setPalette` to the store type; add `palette: "kaneo"`, `setPalette: (palette) => set({ palette })` to the initializer; in `onRehydrateStorage`, call `state.setPalette(normalizePalette(state.palette))`.

- [ ] **Step 5: Add store assertions** to the same test file

```ts
import { useUserPreferencesStore } from "./user-preferences";

it("defaults to kaneo and persists a switch", () => {
  useUserPreferencesStore.setState({ palette: "kaneo" });
  expect(useUserPreferencesStore.getState().palette).toBe("kaneo");
  useUserPreferencesStore.getState().setPalette("modern");
  expect(useUserPreferencesStore.getState().palette).toBe("modern");
  useUserPreferencesStore.getState().setPalette("kaneo");
});
```

- [ ] **Step 6: Run and commit**

Run: `pnpm --filter @kaneo/web exec vp test run src/store/color-palette.test.ts`
Expected: PASS.

```bash
git add apps/web/src/store/color-palette.ts apps/web/src/store/color-palette.test.ts apps/web/src/store/user-preferences.ts
git commit -m "feat(web): add color palette preference"
```

### Task 2: OKLCH palette CSS and guards

**Files:**
- Create: `apps/web/src/lib/color/css-tokens.ts`
- Create: `apps/web/src/lib/color/oklch.ts`
- Create: `apps/web/src/lib/color/palette-tokens.test.ts`
- Create: `apps/web/src/lib/color/palette-contrast.test.ts`
- Modify: `apps/web/src/index.css` (append after the `.dark` block)

**Interfaces:**
- Consumes: nothing.
- Produces: `readTokenBlock(css: string, selector: string): Map<string, string>`; `oklchToSrgb(value: string): [number, number, number] | null`; `contrastRatio(a: string, b: string): number | null`.

- [ ] **Step 1: Write the failing parity test** in `palette-tokens.test.ts`

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { readTokenBlock } from "./css-tokens";

const css = readFileSync(new URL("../../../index.css", import.meta.url), "utf8");
const NON_COLOR = /^--(font|radius|ease|animate)/;

function colorTokens(selector: string) {
  return [...readTokenBlock(css, selector).keys()].filter((name) => !NON_COLOR.test(name));
}

describe("modern palette token coverage", () => {
  it("overrides every base color token in light mode", () => {
    const base = colorTokens(":root");
    const modern = new Set(colorTokens(':root[data-palette="modern"]'));
    expect(base.filter((name) => !modern.has(name))).toEqual([]);
  });

  it("overrides every light palette token in dark mode", () => {
    const light = colorTokens(':root[data-palette="modern"]');
    const dark = new Set(colorTokens(':root.dark[data-palette="modern"]'));
    expect(light.filter((name) => !dark.has(name))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @kaneo/web exec vp test run src/lib/color/palette-tokens.test.ts`
Expected: FAIL — cannot resolve `./css-tokens`.

- [ ] **Step 3: Implement `css-tokens.ts`**

Parse with a plain block scan, not a CSS dependency: find the selector, take the text between its `{` and the matching `}`, and match `--name: value;` declarations (values may contain `;` only inside functions, and the blocks have no nested rules). Strip `/* … */` comments first.

- [ ] **Step 4: Append the palette blocks from spec §7.3 to `index.css`**

Copy the two blocks verbatim, after the `.dark` block. Verify the base values above them are untouched.

- [ ] **Step 5: Run the parity test**

Run: `pnpm --filter @kaneo/web exec vp test run src/lib/color/palette-tokens.test.ts`
Expected: PASS. If it lists tokens, add them to both blocks.

- [ ] **Step 6: Write the failing contrast test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { readTokenBlock } from "./css-tokens";
import { contrastRatio } from "./oklch";

const css = readFileSync(new URL("../../../index.css", import.meta.url), "utf8");
const light = readTokenBlock(css, ':root[data-palette="modern"]');
const dark = readTokenBlock(css, ':root.dark[data-palette="modern"]');

const TEXT_PAIRS = [
  ["foreground", "background"], ["foreground", "card"],
  ["muted-foreground", "background"], ["info-foreground", "background"],
  ["success-foreground", "background"], ["warning-foreground", "background"],
  ["destructive-foreground", "background"], ["board-title", "board-card"],
  ["chip-foreground", "background"],
] as const;
const ACCENT_TOKENS = ["primary", "ring", "sidebar-primary", "sidebar-ring"] as const;
const NON_TEXT_PAIRS = [
  ["ring", "background"], ["board-card-focus", "board-card"],
  ["priority-low", "background"], ["priority-medium", "background"],
  ["priority-high", "background"], ["priority-urgent", "background"],
] as const;

describe.each([["light", light], ["dark", dark]])("modern %s accent", (_name, tokens) => {
  it.each(ACCENT_TOKENS)("%s keeps an accent hue", (name) => {
    const parsed = parseOklch(tokens.get(`--${name}`)!);
    expect(parsed, `${name} must be oklch`).not.toBeNull();
    expect(parsed!.c, `${name} chroma`).toBeGreaterThanOrEqual(0.12);
    expect(Math.abs(parsed!.h - 275), `${name} hue`).toBeLessThanOrEqual(10);
  });
});

describe.each([["light", light], ["dark", dark]])("modern %s contrast", (_name, tokens) => {
  it.each(TEXT_PAIRS)("%s on %s meets 4.5:1", (fg, bg) => {
    const ratio = contrastRatio(tokens.get(`--${fg}`)!, tokens.get(`--${bg}`)!);
    expect(ratio, `${fg}/${bg} = ${ratio}`).toBeGreaterThanOrEqual(4.5);
  });
  it.each(NON_TEXT_PAIRS)("%s on %s meets 3:1", (fg, bg) => {
    const ratio = contrastRatio(tokens.get(`--${fg}`)!, tokens.get(`--${bg}`)!);
    expect(ratio, `${fg}/${bg} = ${ratio}`).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 7: Implement `oklch.ts`**

`parseOklch(value)` returns `{ l, c, h, alpha }` for `oklch(L C H [/ A])` and `null` otherwise (used by the accent test). `oklchToSrgb` accepts `oklch(L C H)` or `oklch(L C H / A)`; parses the three numbers plus optional alpha, converts with the standard OKLab matrix, then the sRGB transfer function, and returns `[r, g, b]` clamped to 0–1 (`null` for any other color syntax). `contrastRatio` converts both, computes relative luminance from the linear-light values, and returns `(lighter + 0.05) / (darker + 0.05)`; it is `null` when either input is not oklch. Alpha is ignored for these opaque comparisons (all pairs above are opaque).

- [ ] **Step 8: Run, tune values if needed, commit**

Run: `pnpm --filter @kaneo/web exec vp test run src/lib/color`
Expected: PASS. The failure message prints the measured ratio; adjust only the L channel of the failing token.

```bash
git add apps/web/src/index.css apps/web/src/lib/color
git commit -m "feat(web): add opt-in OKLCH palette tokens"
```

### Task 3: Apply the palette at runtime

**Files:**
- Create: `apps/web/src/components/providers/theme-provider/theme-provider.test.tsx`
- Modify: `apps/web/src/components/providers/theme-provider/index.tsx`

**Interfaces:**
- Consumes: `useUserPreferencesStore` `palette` (Task 1).
- Produces: `<html data-palette="modern">` when modern is selected; no attribute for kaneo.

- [ ] **Step 1: Write the failing test**

```tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ThemeProvider } from ".";
import { useUserPreferencesStore } from "@/store/user-preferences";

function renderWith(palette: "kaneo" | "modern", theme: "light" | "dark") {
  useUserPreferencesStore.setState({ palette, theme });
  render(<ThemeProvider><span /></ThemeProvider>);
  return document.documentElement;
}

describe("ThemeProvider palette", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-palette");
    useUserPreferencesStore.setState({ theme: "dark", palette: "kaneo" });
  });

  it("sets no palette attribute for kaneo", () => {
    expect(renderWith("kaneo", "dark").dataset.palette).toBeUndefined();
  });

  it("sets data-palette for modern", () => {
    expect(renderWith("modern", "light").dataset.palette).toBe("modern");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @kaneo/web exec vp test run src/components/providers/theme-provider`
Expected: both palette assertions fail.

- [ ] **Step 3: Implement**

In the same effect, read `palette` from the store and apply it once per run:

```ts
if (palette === "modern") root.dataset.palette = "modern";
else delete root.dataset.palette;
```

Add `palette` to the effect dependencies. Do not touch the scheme logic or the media-query listener.

- [ ] **Step 4: Run and commit**

Run: `pnpm --filter @kaneo/web exec vp test run src/components/providers/theme-provider`
Expected: PASS.

```bash
git add apps/web/src/components/providers/theme-provider
git commit -m "feat(web): apply selected color palette to html"
```

### Task 4: Palette setting row

**Files:**
- Create: `apps/web/src/components/settings/preferences/palette-row.tsx`
- Create: `apps/web/src/components/settings/preferences/palette-row.test.tsx`
- Create: `apps/web/src/components/account/palette-swatch.tsx`
- Modify: `apps/web/src/components/settings/preferences/preferences-page.tsx`
- Modify: `i18n/en-US.json`, `i18n/schema.json` (generated), other locales (generated)

**Interfaces:**
- Consumes: `ColorPalette`, store `palette` / `setPalette`, `ThemePreviewWindow`.
- Produces: `<PaletteRow />`; `<PaletteSwatch palette={ColorPalette} />` rendering fixed literal colors.

- [ ] **Step 1: Write the failing test**

Render `PaletteRow`, assert two radio options by accessible name (`settings:preferencesPage.paletteKaneo`, `…paletteModern`), click modern, assert `useUserPreferencesStore.getState().palette === "modern"`, and assert the selected option carries the check icon. Mirror `priority-icons-row.test.tsx` for the `react-i18next` mock and store reset in `afterEach`.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @kaneo/web exec vp test run src/components/settings/preferences/palette-row.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PaletteRow`**

`SettingsRow` (stacked) with the palette title/description, and a `RadioGroup` of two `RadioPrimitive.Root` cards in a 2-column grid, matching `ThemePicker`'s focus/`data-checked` classes. Each card contains a two-tone `ThemePreviewWindow` pair plus `<PaletteSwatch palette={…} />`. Selection calls `setPalette`.

- [ ] **Step 4: Implement `PaletteSwatch`**

A row of four 12px dots with fixed hex/oklch literals — background, card, text, primary — per palette. Not tokens: the swatch must show its own palette while another is active (same reason `ThemePreviewWindow` is fixed).

- [ ] **Step 5: Add i18n keys and regenerate**

Add the §7.5 keys to `i18n/en-US.json` under `settings.preferencesPage`, then run:

```bash
pnpm i18n:schema
pnpm i18n:check:fix
```

- [ ] **Step 6: Place the row**

In `preferences-page.tsx`, render `<PaletteRow />` in the Theme `SettingsSection`, directly under `<ThemePicker … />`.

- [ ] **Step 7: Run, i18n check, commit**

```bash
pnpm --filter @kaneo/web exec vp test run src/components/settings/preferences/palette-row.test.tsx
pnpm i18n:check
git add apps/web/src/components/settings/preferences/palette-row.* apps/web/src/components/account/palette-swatch.tsx apps/web/src/components/settings/preferences/preferences-page.tsx i18n
git commit -m "feat(web): add palette picker to preferences"
```

### Task 5: Color-scheme, FOUC bootstrap, contrast/forced-colors fallbacks

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/index.css`

**Interfaces:**
- Consumes: the persisted `user-preferences` shape (`{ state: { theme, palette } }`).
- Produces: correct first paint and native-control scheme.

- [ ] **Step 1: Add `color-scheme`**

`color-scheme: light;` in `:root`, `color-scheme: dark;` in `.dark`. Do not use `light dark` on `:root`: the app pins a scheme by class, and the OS preference is already resolved in JS.

- [ ] **Step 2: Add the FOUC bootstrap** in `index.html`, in `<head>` after the meta tags

```html
<script>
  try {
    var prefs = JSON.parse(localStorage.getItem("user-preferences") || "{}");
    var state = prefs.state || {};
    var theme = state.theme;
    if (theme === "system") {
      theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.classList.add(theme === "light" ? "light" : "dark");
    if (state.palette === "modern") document.documentElement.dataset.palette = "modern";
  } catch (e) {}
</script>
```

- [ ] **Step 3: Add `prefers-contrast` and `forced-colors` blocks** after the palette blocks

Both palettes: in `@media (prefers-contrast: more)`, raise `--border`, `--input`, `--chip-border` to at least 3:1 against `--background` (opaque colors, alpha ≥ 0.35 for dark-on-light and ≥ 0.5 for light-on-dark is a starting point; verify with the contrast helper).

In `@media (forced-colors: active)`, remap `--foreground`/`--card-foreground`/`--popover-foreground`/`--board-title` to `CanvasText`, `--background`/`--card`/`--popover`/`--board-card` to `Canvas`, `--border`/`--input` to `CanvasText`, `--primary` to `ButtonText`, `--ring`/`--board-card-focus` to `Highlight`.

- [ ] **Step 4: Verify in the browser**

With the dev server running, load `http://localhost:5173` with each of the four combinations (kaneo/modern × light/dark), then check Preferences, a board, and a task detail. Reload with `localStorage` cleared to confirm no flash of the wrong scheme.

- [ ] **Step 5: Commit**

```bash
git add apps/web/index.html apps/web/src/index.css
git commit -m "fix(web): align native controls and first paint with the theme"
```

### Task 6: Full verification

- [ ] **Step 1: Typecheck and lint**

```bash
pnpm --filter @kaneo/web typecheck
pnpm lint
```

- [ ] **Step 2: Tests**

```bash
pnpm --filter @kaneo/web exec vp test run src/store src/lib/color src/components/providers/theme-provider src/components/settings/preferences
```

- [ ] **Step 3: i18n and OpenAPI sanity**

```bash
pnpm i18n:check
pnpm openapi:check
```

`openapi:check` should be unchanged; it confirms no route/schema drift.

- [ ] **Step 4: Report** what ran and the results, including the measured contrast ratios from Task 2.

## Self-Review

- Spec coverage: §7.1 → Task 1; §7.2 → Task 3; §7.3 → Task 2; §7.4/7.5 → Task 4; §7.6 → Task 5; §9 → Tasks 1–4 and 6. §8 follow-through (public project, auth) is satisfied by Task 3 because they share the provider; no task needed. §12 (more palettes) is an open decision, intentionally not implemented.
- Type consistency: `ColorPalette` is defined once in `store/color-palette.ts` and imported by the row and swatch; no duplicate unions.
- Review Focus: each line maps to Task 1 (fallbacks), Task 2 (drift + contrast), Task 3 (system scheme + shared provider), Task 5 (blocked storage).
