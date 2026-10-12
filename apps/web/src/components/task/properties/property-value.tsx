import type { ComponentProps } from "react";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { cn } from "@/lib/cn";
import type { ShortcutId } from "@/lib/shortcuts/catalog";

type PropertyValueProps = ComponentProps<"button"> & {
  shortcutId?: ShortcutId;
};

export function PropertyValue({
  shortcutId,
  className,
  children,
  ...props
}: PropertyValueProps) {
  return (
    <button
      type="button"
      className={cn(
        "group/value flex h-7.5 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left font-medium text-[13px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:bg-accent data-popup-open:bg-accent disabled:cursor-default disabled:hover:bg-transparent [&_svg]:size-3.5 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      {shortcutId && (
        <span
          aria-hidden="true"
          className="ms-auto hidden shrink-0 opacity-0 transition-opacity group-hover/value:opacity-100 sm:inline-flex"
        >
          <ShortcutKeys id={shortcutId} />
        </span>
      )}
    </button>
  );
}
