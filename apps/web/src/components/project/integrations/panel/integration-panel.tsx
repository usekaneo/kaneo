import type { ReactNode } from "react";

type IntegrationPanelProps = {
  children: ReactNode;
};

export function IntegrationPanel({ children }: IntegrationPanelProps) {
  return <div className="flex flex-col divide-y divide-border">{children}</div>;
}
