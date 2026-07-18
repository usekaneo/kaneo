# 001 — Establish motion tokens and easing discipline

- **Status**: DONE
- **Commit**: 813dcb36
- **Severity**: HIGH
- **Category**: Easing & duration / Cohesion & tokens
- **Estimated scope**: 8 files, small edits

## Problem

No easing/duration token system exists; `apps/web/src/index.css` defines only `--animate-skeleton`. Hand-typed curves are scattered (`apps/web/src/components/kanban-board/index.tsx:114` `cubic-bezier(0.25, 0.46, 0.45, 0.94)`, `theme-toggle-dropdown.tsx:21`). Dialog-family panels enter/exit with `ease-in-out` (slow start delays the moment the user watches): `ui/dialog.tsx:110`, `ui/alert-dialog.tsx:69`, `ui/command.tsx:77`, `ui/sheet.tsx:78`, all `duration-200 ease-in-out`. The sidebar collapses with `linear` (reserved for constant motion): `ui/sidebar.tsx:240,251,431,311` and `common/layout.tsx:30` `transition-[...] duration-200 ease-linear`. Three unused animation plugins are installed: `tailwind-animate`, `tailwindcss-animate`, `tw-animate-css` (no `@plugin` load, zero class usages).

## Target

In `apps/web/src/index.css` inside the existing `@theme` block, override Tailwind's weak built-ins with strong curves (this upgrades every existing `ease-out`/`ease-in-out` utility app-wide, including the coss primitives):

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
```

- Dialog family panels: `ease-in-out` → `ease-out` (entrances/exits use ease-out).
- Sidebar + layout collapse: `ease-linear` → `ease-in-out` (on-screen morph).
- `kanban-board/index.tsx:114` dnd-kit easing string → `"cubic-bezier(0.23, 1, 0.32, 1)"`.
- `theme-toggle-dropdown.tsx:21` hand-typed curve → `var(--ease-out)` (or the same literal if a CSS var cannot be used in that position).
- Remove the three plugin packages from `apps/web/package.json` via `pnpm remove tailwind-animate tailwindcss-animate tw-animate-css --filter @kaneo/web`.

## Repo conventions to follow

- Tailwind v4 CSS-first config: tokens live in the `@theme` block of `apps/web/src/index.css`.
- Exemplar of correct entrance easing: `ui/popover.tsx:67` (`duration-150 ease-out`).

## Boundaries

- Do NOT touch `ui/toast.tsx` (its 500ms `cubic-bezier(.22,1,.36,1)` swipe curve is deliberate).
- Do NOT change `accordion.tsx`/`tabs.tsx` `ease-in-out` (genuine morphs, correct).
- Do NOT touch the anti-autofill `5000s ease-in-out` transitions (index.css:9, input.tsx, number-field.tsx).

## Verification

- Mechanical: `pnpm --filter @kaneo/web build` passes; `grep -rn "tailwindcss-animate\|tw-animate-css\|\"tailwind-animate\"" apps/web` returns nothing.
- Feel: open the create-task dialog — it should arrive fast and settle (no slow start). Collapse the sidebar — motion eases, no constant-speed feel.
