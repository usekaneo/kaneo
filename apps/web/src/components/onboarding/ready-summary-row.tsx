import { CircleCheck } from "lucide-react";

type ReadySummaryRowProps = { label: string; value: string };

export function ReadySummaryRow({ label, value }: ReadySummaryRowProps) {
  return (
    <li className="flex items-center gap-3 border-border px-3.5 py-3 not-last:border-b">
      <CircleCheck className="size-4 shrink-0 text-success-foreground" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="truncate text-foreground text-sm">{value}</span>
      </span>
    </li>
  );
}
