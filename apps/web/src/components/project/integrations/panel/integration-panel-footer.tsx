import type { ReactNode } from "react";

type IntegrationPanelFooterProps = {
  start?: ReactNode;
  children?: ReactNode;
};

export function IntegrationPanelFooter({
  start,
  children,
}: IntegrationPanelFooterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">{start}</div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
