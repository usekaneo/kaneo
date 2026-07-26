# 007 — Animate card/row enter and exit on board and lists

- **Status**: DONE
- **Commit**: 813dcb36
- **Severity**: MEDIUM (highest fluid-UI impact, riskiest)
- **Category**: Missed opportunities
- **Estimated scope**: 3 files, framer-motion AnimatePresence

## Problem

Creating, deleting, or moving a task teleports it in/out and siblings jump to close the gap: `components/kanban-board/column/column-dropzone.tsx:39-47`, `components/list-view/index.tsx:355`, `components/backlog-list-view/index.tsx:370` render bare `tasks.map(...)`. dnd-kit only animates pointer drags. The in-repo exemplar is subtasks: `task-subtasks.tsx:356` (`AnimatePresence initial={false}`) + `subtask-row.tsx:49-54`.

## Target

Wrap the three map sites in `<AnimatePresence initial={false} mode="popLayout">` and each card/row in a `motion.div` with `initial={{ opacity: 0, scale: 0.98 }}`, `animate={{ opacity: 1, scale: 1 }}`, `exit={{ opacity: 0, scale: 0.98 }}`, `transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}`, keyed by task id.

**Hard constraint — dnd-kit coexistence**: the sortable transform must remain on the existing card element (dnd-kit's `useSortable` ref/style). The motion wrapper must NOT set `layout` (no FLIP) and must not intercept pointer events; if drag visuals glitch, fall back to CSS-only entrance (`starting:` variant) and exit-less removal, and report.

`initial={false}` is mandatory so board load doesn't animate 100 cards.

## Boundaries

- Do NOT add `layout` props (deliberate: FLIP reflow conflicts with dnd-kit transforms; out of scope).
- Do NOT animate during initial mount or route changes.
- Respect `useReducedMotion` (plan 005): reduced → opacity-only.

## Verification

- Mechanical: `pnpm --filter @kaneo/web build`.
- Feel: create a task — the card settles in (subtle scale+fade). Delete/move via status popover — the card fades out and the list closes up without a hard jump. Drag cards between columns — dnd-kit behavior unchanged (no double transforms, no offset jumps). Load a 50-card board — no entrance storm.
