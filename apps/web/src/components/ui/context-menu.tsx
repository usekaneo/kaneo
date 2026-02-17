import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/cn";

function ContextMenu(props: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({
  asChild,
  children,
  ...props
}: ContextMenuPrimitive.Trigger.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <ContextMenuPrimitive.Trigger
        data-slot="context-menu-trigger"
        render={children}
        {...props}
      />
    );
  }

  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props}>
      {children}
    </ContextMenuPrimitive.Trigger>
  );
}

function ContextMenuPortal(props: ContextMenuPrimitive.Portal.Props) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  );
}

function ContextMenuGroup(props: ContextMenuPrimitive.Group.Props) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  );
}

function ContextMenuRadioGroup(props: ContextMenuPrimitive.RadioGroup.Props) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  );
}

function ContextMenuSub(props: ContextMenuPrimitive.SubmenuRoot.Props) {
  return (
    <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
  );
}

function ContextMenuContent({
  className,
  sideOffset = 4,
  align = "center",
  side = "right",
  alignOffset = 0,
  anchor,
  children,
  ...props
}: ContextMenuPrimitive.Popup.Props & {
  sideOffset?: ContextMenuPrimitive.Positioner.Props["sideOffset"];
  side?: ContextMenuPrimitive.Positioner.Props["side"];
  align?: ContextMenuPrimitive.Positioner.Props["align"];
  alignOffset?: ContextMenuPrimitive.Positioner.Props["alignOffset"];
  anchor?: ContextMenuPrimitive.Positioner.Props["anchor"];
}) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50"
        data-slot="context-menu-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <ContextMenuPrimitive.Popup
          className={cn(
            "relative flex not-[class*='w-']:min-w-32 origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 outline-none transition-[scale,opacity,transform] duration-150 ease-out before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-starting-style:scale-98 data-ending-style:scale-98 data-starting-style:opacity-0 data-ending-style:opacity-0 data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className,
          )}
          data-slot="context-menu-content"
          {...props}
        >
          <div className="max-h-(--available-height) w-full overflow-y-auto p-1">
            {children}
          </div>
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ContextMenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      className={cn(
        "flex min-h-8 items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-popup-open:bg-accent data-inset:ps-8 data-highlighted:text-accent-foreground data-popup-open:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className,
      )}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      {...props}
    >
      {children}
      <ChevronRightIcon className="-me-0.5 ms-auto opacity-80" />
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}

function ContextMenuSubContent({
  className,
  sideOffset = 0,
  align = "start",
  alignOffset = -5,
  ...props
}: ContextMenuPrimitive.Popup.Props & {
  sideOffset?: ContextMenuPrimitive.Positioner.Props["sideOffset"];
  align?: ContextMenuPrimitive.Positioner.Props["align"];
  alignOffset?: ContextMenuPrimitive.Positioner.Props["alignOffset"];
}) {
  return (
    <ContextMenuContent
      align={align}
      alignOffset={alignOffset}
      className={className}
      data-slot="context-menu-sub-content"
      side="inline-end"
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: ContextMenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "[&>svg]:-mx-0.5 flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-inset:ps-8 data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:shrink-0",
        variant === "destructive" && "text-destructive",
        className,
      )}
      data-inset={inset}
      data-slot="context-menu-item"
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ContextMenuPrimitive.CheckboxItem.Props) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="context-menu-checkbox-item"
      {...props}
    >
      <ContextMenuPrimitive.CheckboxItemIndicator className="col-start-1">
        <CheckIcon />
      </ContextMenuPrimitive.CheckboxItemIndicator>
      <div className="col-start-2 inline-flex items-center gap-2">
        {children}
      </div>
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: ContextMenuPrimitive.RadioItem.Props) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(
        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="context-menu-radio-item"
      {...props}
    >
      <ContextMenuPrimitive.RadioItemIndicator className="col-start-1">
        <CircleIcon className="size-2 fill-current" />
      </ContextMenuPrimitive.RadioItemIndicator>
      <div className="col-start-2 inline-flex items-center gap-2">
        {children}
      </div>
    </ContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: ContextMenuPrimitive.GroupLabel.Props & { inset?: boolean }) {
  return (
    <ContextMenuPrimitive.GroupLabel
      className={cn(
        "px-2 py-1.5 font-medium text-muted-foreground text-xs data-inset:ps-8",
        className,
      )}
      data-inset={inset}
      data-slot="context-menu-label"
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("mx-2 my-1 h-px bg-border", className)}
      data-slot="context-menu-separator"
      {...props}
    />
  );
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ms-auto text-muted-foreground text-xs tracking-widest",
        className,
      )}
      data-slot="context-menu-shortcut"
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
