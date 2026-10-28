import type { ReactNode } from "react";

type PreviewColumnProps = {
  icon: ReactNode;
  name: string;
  count: number;
  children?: ReactNode;
};

export function PreviewColumn({
  icon,
  name,
  count,
  children,
}: PreviewColumnProps) {
  return (
    <div className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/40 dark:bg-card/90">
      <div className="flex items-center gap-2 border-border border-b px-3 py-2 text-muted-foreground">
        {icon}
        <span className="font-medium text-[13px] text-foreground">{name}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-[11px]">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-2">{children}</div>
    </div>
  );
}
