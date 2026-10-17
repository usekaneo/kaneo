import type { ReactNode } from "react";

type IntegrationStepsProps = {
  children: ReactNode;
};

export function IntegrationSteps({ children }: IntegrationStepsProps) {
  return <ol className="p-4">{children}</ol>;
}
