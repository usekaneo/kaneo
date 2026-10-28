import { RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";

type DirectoryHeadingProps = {
  title: ReactNode;
  count?: ReactNode;
  refreshingLabel?: string;
};

export function DirectoryHeading({
  title,
  count,
  refreshingLabel,
}: DirectoryHeadingProps) {
  return (
    <span className="flex items-center gap-2">
      {title}
      {count !== undefined ? (
        <span className="text-[13px] font-normal text-muted-foreground tabular-nums">
          {count}
        </span>
      ) : null}
      {refreshingLabel ? (
        <RefreshCwIcon
          role="img"
          aria-label={refreshingLabel}
          className="size-3 animate-spin text-muted-foreground"
        />
      ) : null}
    </span>
  );
}
