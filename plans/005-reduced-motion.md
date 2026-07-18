# 005 — prefers-reduced-motion support

- **Status**: DONE
- **Commit**: 813dcb36
- **Severity**: MEDIUM (accessibility)
- **Category**: Accessibility
- **Estimated scope**: ~10 files, class additions + 4 framer files

## Problem

Zero `prefers-reduced-motion` / `useReducedMotion` occurrences app-wide. Overlays translate/scale, framer flows slide, sidebar morphs — all ungated.

## Target

Reduced motion = fewer and gentler, not zero: keep opacity fades, drop movement.

- coss primitives (`ui/popover.tsx`, `ui/select.tsx`, `ui/menu.tsx`, `ui/tooltip.tsx`, `ui/dialog.tsx`, `ui/sheet.tsx`, `ui/command.tsx`, `ui/alert-dialog.tsx`): add `motion-reduce:` overrides neutralizing the transform deltas while keeping opacity, e.g. for a popup with `data-starting-style:scale-98 data-starting-style:-translate-y-1`: append `motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0` (mirror for `data-ending-style` and each side variant present).
- Sidebar (`ui/sidebar.tsx` width transitions) and section reveals: `motion-reduce:transition-none` on the movement transitions.
- Framer files (`onboarding-flow.tsx`, `profile-setup-flow.tsx`, `task-subtasks.tsx`, `subtask-row.tsx`): use `useReducedMotion()` from framer-motion; when true, zero out `y`/`height` deltas but keep opacity fades.
- Skeleton shimmer (`--animate-skeleton`): leave as is (opacity-only, comprehension-aiding).

## Boundaries

- Do NOT globally disable all transitions (no `* { transition: none }` nuke) — color/opacity feedback stays.

## Verification

- Mechanical: `pnpm --filter @kaneo/web build`; `grep -rn "motion-reduce\|useReducedMotion" apps/web/src | wc -l` > 10.
- Feel: DevTools Rendering panel → emulate `prefers-reduced-motion: reduce`; open popover/dialog/sidebar — things fade without sliding or scaling; onboarding steps crossfade without vertical movement.
