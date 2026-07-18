# 003 — Command palette and search open instantly

- **Status**: DONE
- **Commit**: 813dcb36
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 3 files

## Problem

The Cmd+K command palette and "/" search are 100+/day keyboard surfaces. Per the catalog: "No animation. Ever." (Raycast has none). Currently both render through `CommandDialogPopup` (`ui/command.tsx:77`), which animates `scale-98 + opacity` over 200ms, plus an overlay fade (`ui/command.tsx:41`). Surfaces: `components/command-palette/index.tsx:247`, `components/search-command-menu/index.tsx:194`, `components/bulk-selection/bulk-toolbar.tsx:464`.

## Target

Add an `instant?: boolean` prop to the command dialog popup/overlay in `ui/command.tsx`. When set, append `transition-none data-starting-style:scale-100 data-starting-style:opacity-100 data-ending-style:scale-100 data-ending-style:opacity-100` (and `transition-none data-starting-style:opacity-100 data-ending-style:opacity-100` on the overlay) so open/close is immediate. Pass `instant` from the command palette, the search menu, and the bulk-toolbar palette.

## Repo conventions to follow

- coss primitives compose className via `cn(...)`; extend props the way `ui/dialog.tsx` extends Base UI props.

## Boundaries

- Do NOT remove the animation for other `CommandDialog` consumers; only the three keyboard surfaces pass `instant`.
- Do NOT change palette markup or focus behavior.

## Verification

- Mechanical: `pnpm --filter @kaneo/web build`.
- Feel: hit Cmd+K repeatedly — the palette appears/disappears with zero transition, like Raycast. Regular dialogs (create task) still animate.
