# 006 — Fluid micro-moments

- **Status**: DONE
- **Commit**: 813dcb36
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Interruptibility
- **Estimated scope**: 6 files

## Problem / Target (one per seam)

1. **Bulk-select toolbar pops in** — `components/bulk-selection/bulk-toolbar.tsx:381-387` (and the backlog variant) `return null` → fixed bottom bar appears instantly. Target: entrance via Tailwind v4 `starting:` variant on the fixed wrapper: `transition-[translate,opacity] duration-200 ease-out starting:translate-y-3 starting:opacity-0` (dismissal stays instant — response snaps, per asymmetric-timing rule).
2. **List sections snap while the chevron animates** — `components/list-view/index.tsx:348-351` (+ backlog `:364`) hard-mount the section body next to a `transition-transform` chevron (`:306-311`). Target: entrance softening on the body: `starting:opacity-0 starting:-translate-y-1 transition-[translate,opacity] duration-150 ease-out`. Do not wrap `SortableContext` in new interactive containers.
3. **Checkbox check pops from nothing** — `ui/checkbox.tsx:18` indicator uses `data-unchecked:hidden`. Target: keep the indicator mounted (Base UI `keepMounted` if required) and switch to `data-unchecked:opacity-0 data-unchecked:scale-90 transition-[opacity,scale] duration-150 ease-out`; verify the indeterminate state still renders.
4. **Notification badge teleports in** — `components/notification/notification-dropdown.tsx:273-279`. Target: on the count span: `starting:scale-75 starting:opacity-0 transition-[scale,opacity] duration-200 ease-out`.
5. **Tooltip re-delay in the task sidebar** — `components/task/task-properties-sidebar.tsx:147,172,337,362,529,554`: six sibling `TooltipProvider`s. Target: one shared `TooltipProvider` per toolbar group so adjacent tooltips skip the delay.
6. **Subtask rows tween without physics** — `components/task/subtask-row.tsx:51-54`. Target: `transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}` and add `scale: 0.98` to the `initial`/`exit` alongside existing opacity/height.

## Boundaries

- Entrances only where elements conditionally mount; do not restructure conditional rendering into always-mounted DOM (except the checkbox indicator if `keepMounted` is needed).
- Badge/toolbar/section motion must never delay interactivity.

## Verification

- Mechanical: `pnpm --filter @kaneo/web build`.
- Feel: select cards — the toolbar rises from the bottom edge; deselect — gone instantly. Toggle a checkbox rapidly — the check scales in and interruption retargets (no restart flicker). New notification — badge pops in. Hover the two sidebar copy buttons in sequence — the second tooltip appears without the full delay.
