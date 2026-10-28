export function DateLimitHint({ children }: { children: string }) {
  return (
    <div className="flex h-8 items-center gap-2 border-border/80 border-t px-3 text-muted-foreground text-xs">
      <span
        aria-hidden="true"
        className="size-1 shrink-0 rounded-full bg-muted-foreground"
      />
      {children}
    </div>
  );
}
