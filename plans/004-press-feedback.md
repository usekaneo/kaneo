# 004 — Tactile press feedback on buttons and task cards

- **Status**: DONE
- **Commit**: 813dcb36
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 2 files

## Problem

No interactive surface presses. `ui/button.tsx:34` variants change color/shadow on `:active`/`data-pressed` but never scale. `components/kanban-board/task-card.tsx:184` (the board's primary tap target) has hover styling and zero press response.

## Target

- Button base (the shared class string in `ui/button.tsx`): add `active:scale-[0.97] data-pressed:scale-[0.97]` and extend the base transition to include `scale` with ~150ms ease-out (base currently `transition-shadow`; becomes `transition-[box-shadow,scale] duration-150 ease-out`).
- Task card: add `active:scale-[0.98]` (larger element, subtler per catalog 0.95–0.98). Depends on plan 002 having added `scale` to the card's transitioned properties.

## Boundaries

- Keep scale subtle; do NOT exceed the 0.95–0.98 band.
- Do NOT add press scale to list rows (full-width rows look wrong scaling).

## Verification

- Mechanical: `pnpm --filter @kaneo/web build`.
- Feel: click-and-hold any button — it compresses; release — it snaps back fast. Card press feels tactile, not bouncy. Keyboard activation (Enter/Space) shows the same pressed state via `data-pressed`.
