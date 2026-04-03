# coss Toolbar

## When to use

- Grouped command/action strips.
- Editor-like tool controls and mode toggles.

## Install

```bash
npx shadcn@latest add @coss/toolbar
```

Manual deps from docs:

```bash
npm install @base-ui/react
```

## Canonical imports

```tsx
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar"
```

## Minimal pattern

```tsx
<Toolbar>
  <ToggleGroup className="border-none p-0" defaultValue={["left"]}>
    <ToolbarButton aria-label="Align left" render={<ToggleGroupItem value="left" />}>
      <AlignLeftIcon />
    </ToolbarButton>
    <ToolbarButton aria-label="Align center" render={<ToggleGroupItem value="center" />}>
      <AlignCenterIcon />
    </ToolbarButton>
  </ToggleGroup>
  <ToolbarSeparator />
  <ToolbarGroup>
    <ToolbarButton render={<Button type="button" variant="outline" />}>
      Save
    </ToolbarButton>
  </ToolbarGroup>
</Toolbar>
```

## Patterns from coss particles

- **Part composition via `render`**: use `ToolbarButton render={<ToggleGroupItem ... />}` or `render={<Button ... />}` instead of re-implementing button behavior.
- **Grouped layout**: use `ToolbarGroup` boundaries with `ToolbarSeparator` between logical command clusters.
- **Icon-only controls**: pair icon buttons with explicit `aria-label`; combine with `Tooltip` for discoverability.
- **Embedded selects**: wrap `SelectTrigger` with `ToolbarButton render={...}` to keep visual consistency in mixed control bars.
- **Formatting rows**: combine `ToggleGroup` + `ToolbarButton` for alignment/formatting command sets.

## Common pitfalls

- Dropping `ToolbarSeparator`, causing unrelated command clusters to collapse visually.
- Missing `aria-label` on icon-only toolbar actions.
- Rendering raw `Button`/`ToggleGroupItem` next to toolbar controls without `ToolbarButton`, creating inconsistent density/spacing.
- Treating Toolbar as a state manager; control selection/toggle state through composed primitives (`ToggleGroup`, `Select`, etc.).

## Useful particle references

- core toolbar patterns: `p-toolbar-1`
- related composition references: `p-toggle-group-1`, `p-group-1`, `p-select-1`

