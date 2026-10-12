import { CheckIcon, GlobeIcon, LockIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type RepositoryPickerRowProps = {
  name: string;
  isPrivate: boolean;
  meta?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
};

export function RepositoryPickerRow({
  name,
  isPrivate,
  meta,
  selected,
  onSelect,
  onConfirm,
}: RepositoryPickerRowProps) {
  const Icon = isPrivate ? LockIcon : GlobeIcon;

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        onDoubleClick={onConfirm}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
          selected && "bg-accent",
        )}
      >
        <Icon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block truncate font-mono text-[13px]">{name}</span>
          {meta ? (
            <span className="block truncate text-xs text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </span>
        {selected ? (
          <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
        ) : null}
      </button>
    </li>
  );
}
