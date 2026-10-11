import { Check, CircleDashed, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { ImportRunProject } from "@/fetchers/import/get-import-run";

type ImportRunStatusIconProps = {
  status: ImportRunProject["status"];
};

export function ImportRunStatusIcon({ status }: ImportRunStatusIconProps) {
  if (status === "completed") {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/8 text-success-foreground dark:bg-success/16"
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/8 text-destructive-foreground dark:bg-destructive/16"
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
