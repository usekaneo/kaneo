export function ColumnSortHint({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-lg border border-border bg-popover/95 px-3 py-2 text-center text-xs font-medium text-popover-foreground shadow-md backdrop-blur-sm"
    >
      {label}
    </div>
  );
}
