import { Check, CircleDashed, X } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import type { ImportRunProject } from "@/fetchers/import/get-import-run";
import { cn } from "@/lib/cn";

type ImportRunStatusIconProps = {
  status: ImportRunProject["status"];
};

const SETTLE_IN =
  "transition-[scale,opacity] duration-200 ease-out starting:scale-50 starting:opacity-0 motion-reduce:starting:scale-100";

export function ImportRunStatusIcon({ status }: ImportRunStatusIconProps) {
  const [previous, setPrevious] = useState(status);
  const [settled, setSettled] = useState(false);
  if (status !== previous) {
    setPrevious(status);
    setSettled(previous === "running");
  }

  if (status === "completed") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full bg-success/8 text-success-foreground dark:bg-success/16",
          settled && SETTLE_IN,
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/8 text-destructive-foreground dark:bg-destructive/16",
          settled && SETTLE_IN,
        )}
      >
        <X className="size-3" strokeWidth={3} />
      </span>
    );
  }

  if (status === "running") {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center"
      >
        <Spinner aria-hidden="true" className="size-4 text-muted-foreground" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center"
    >
      <CircleDashed className="size-4.5 text-muted-foreground/72" />
    </span>
  );
}
