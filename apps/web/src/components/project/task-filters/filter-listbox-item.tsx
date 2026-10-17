import { Autocomplete } from "@base-ui/react/autocomplete";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FilterEntry } from "./filter-entries";

type FilterListboxItemProps = {
  entry: FilterEntry;
  active: boolean;
  onSelect: (entry: FilterEntry, element: HTMLElement) => void;
  onHover?: (entry: FilterEntry, element: HTMLElement) => void;
};

export function FilterListboxItem({
  entry,
  active,
  onSelect,
  onHover,
}: FilterListboxItemProps) {
  return (
    <Autocomplete.Item
      value={entry}
      data-entry={entry.value}
      data-active={active || undefined}
      onClick={(event) => onSelect(entry, event.currentTarget)}
      onPointerEnter={(event) => onHover?.(entry, event.currentTarget)}
      className="group/entry flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] text-foreground outline-none data-active:bg-accent data-highlighted:bg-accent"
    >
      {entry.checked !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border",
            entry.checked
              ? "border-foreground bg-foreground text-background"
              : "border-muted-foreground/50 opacity-0 group-data-highlighted/entry:opacity-100",
          )}
        >
          {entry.checked && <Check className="size-2.5" strokeWidth={3} />}
        </span>
      )}
      {entry.icon && (
        <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-3.5">
          {entry.icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      {entry.meta && (
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {entry.meta}
        </span>
      )}
      {!!entry.badge && (
        <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-foreground px-1 font-semibold text-[10px] text-background tabular-nums">
          {entry.badge}
        </span>
      )}
      {entry.opensSubject && (
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </Autocomplete.Item>
  );
}
