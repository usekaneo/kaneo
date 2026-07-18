# 002 — Scope transition-all to real properties on hot surfaces

- **Status**: DONE
- **Commit**: 813dcb36
- **Severity**: HIGH
- **Category**: Performance / Purpose & frequency
- **Estimated scope**: ~10 files, one class-string edit each

## Problem

`transition-all` animates unintended properties off-GPU and makes keyboard feedback laggy. Confirmed hot spots (current code):

- `components/kanban-board/task-card.tsx:184` — `transition-all duration-200 ease-out`; the j/k focus ring (`:194` `ring-2`) fades 200ms instead of snapping; hover shadow/border rides along.
- `components/list-view/task-row.tsx:182` and `components/backlog-list-view/backlog-task-row.tsx:137` — `transition-all duration-200` with the same ring pattern.
- `components/list-view/index.tsx:296`, `components/backlog-list-view/index.tsx:316` — `transition-all` on section header rows.
- `components/kanban-board/column/index.tsx:16` — `transition-all duration-300 ease-out` (300ms at the UI ceiling for a hover/drag highlight).
- `components/kanban-board/index.tsx:250` — `transition-all duration-200 ease-out` on the board track (nothing dynamic changes; vestigial).
- `routes/.../project/$projectId/board.tsx:184` — find-bar `transition-all duration-180` animating scale/translate/opacity only.
- `ui/dialog.tsx:64`, `ui/sheet.tsx:26`, `ui/command.tsx:41`, `ui/alert-dialog.tsx:26` — overlay `backdrop-blur-sm transition-all duration-200` (transitions backdrop-filter; only opacity changes).
- `ui/progress.tsx:58`, `ui/meter.tsx:50` — `transition-all duration-500` on the fill indicator.
- `routes/.../settings/workspace/labels.tsx:400,489` — `transition-all` next to `hover:scale-110`.

## Target

- Task card: `transition-[background-color,border-color,box-shadow,scale] duration-150 ease-out` (scale kept for plan 004 press feedback; ring-2 is outside → snaps instantly).
- Task/backlog rows and section headers: `transition-colors duration-150`.
- Column shell: `transition-colors duration-150`.
- Board track (`kanban-board/index.tsx:250`): remove the transition classes entirely.
- Find-bar: `transition-[translate,scale,opacity] duration-180 ease-out`.
- Overlays: `transition-opacity duration-200`.
- Progress/meter fill: `transition-[width] duration-300 linear` (constant-motion rule; if the fill is driven by `inset`, transition that property instead).
- Labels page: `transition-transform` on the scale elements (Tailwind v4 `hover:` already gates on hover-capable devices).

## Boundaries

- Do NOT touch `ui/popover.tsx:60,67` / `ui/tooltip.tsx:53,60` positioner property lists (Base UI anchor-following; has `data-instant` opt-out).
- Do NOT alter which visual states exist — only which properties transition.

## Verification

- Mechanical: `pnpm --filter @kaneo/web build`; grep confirms no `transition-all` remains in the files above.
- Feel: press j/k on the board — the focus ring must move with zero fade. Open a dialog — overlay fade unchanged. DevTools Performance: hovering cards paints only color/shadow layers.
