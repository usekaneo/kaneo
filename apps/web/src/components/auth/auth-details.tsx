import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AuthDetail = {
  label: string;
  value: ReactNode;
  mono?: boolean;
};

export function AuthDetails({ rows }: { rows: AuthDetail[] }) {
  return (
    <dl className="flex flex-col rounded-xl border border-border dark:bg-input/16">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex flex-col gap-1 border-border px-3.5 py-3 not-last:border-b"
        >
          <dt className="text-muted-foreground text-xs">{row.label}</dt>
          <dd
            className={cn(
              "min-w-0 text-foreground",
              row.mono
                ? "break-all font-mono text-[13px] leading-[18px]"
                : "truncate text-sm",
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
