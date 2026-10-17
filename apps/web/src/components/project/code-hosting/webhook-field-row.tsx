import type { ReactNode } from "react";

type WebhookFieldRowProps = {
  label: string;
  labelId: string;
  children: ReactNode;
};

export function WebhookFieldRow({
  label,
  labelId,
  children,
}: WebhookFieldRowProps) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span
        id={labelId}
        className="text-[13px] text-muted-foreground sm:w-18 sm:shrink-0"
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}
