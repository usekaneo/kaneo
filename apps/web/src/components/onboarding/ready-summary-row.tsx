type ReadySummaryRowProps = { label: string; value: string };

export function ReadySummaryRow({ label, value }: ReadySummaryRowProps) {
  return (
    <li className="flex min-w-0 flex-col gap-0.5 border-border px-3.5 py-3 not-last:border-b">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="truncate text-foreground text-sm">{value}</span>
    </li>
  );
}
