import type { ReactNode } from "react";

export function DisplaySection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5 px-3 py-3">
      {title && (
        <p className="text-muted-foreground text-xs font-medium">{title}</p>
      )}
      {children}
    </div>
  );
}
