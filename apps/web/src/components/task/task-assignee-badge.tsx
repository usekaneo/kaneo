import { cn } from "@/lib/cn";

type TaskAssigneeBadgeProps = {
  image?: string | null;
  name?: string | null;
  unassignedLabel: string;
  className?: string;
};

function getFirstName(name?: string | null) {
  const trimmedName = name?.trim();
  if (!trimmedName) return "";
  return trimmedName.split(/\s+/)[0] ?? trimmedName;
}

export default function TaskAssigneeBadge({
  name,
  unassignedLabel,
  className,
}: TaskAssigneeBadgeProps) {
  const firstName = getFirstName(name);

  if (!firstName) {
    return (
      <div
        className={cn(
          "inline-flex h-6 items-center rounded-full border border-border bg-muted/70 px-2 text-[11px] font-medium text-muted-foreground",
          className,
        )}
        title={unassignedLabel}
      >
        <span className="leading-none">{unassignedLabel}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex max-w-[84px] items-center rounded-full border border-border/70 bg-background/95 px-2 py-1 text-[11px] shadow-xs backdrop-blur-[2px]",
        className,
      )}
      title={name}
    >
      <span className="truncate leading-none font-medium text-foreground/75">
        {firstName}
      </span>
    </div>
  );
}
