import type { PluginInfo } from "@kaneo/plugin-sdk/web";
import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PluginScopeContext } from "@/lib/plugins/host/plugin-scope-context";
import { PluginFailedMessage } from "./plugin-failed-message";
import { PluginLoading } from "./plugin-loading";

function BoundaryFallback() {
  return <PluginFailedMessage />;
}

type PluginBoundaryProps = {
  scope: PluginInfo;
  resetKey: string;
  children: ReactNode;
};

export function PluginBoundary({
  scope,
  resetKey,
  children,
}: PluginBoundaryProps) {
  return (
    <ErrorBoundary
      key={`${scope.id}@${scope.version}:${resetKey}`}
      fallback={BoundaryFallback}
    >
      <Suspense fallback={<PluginLoading />}>
        <PluginScopeContext.Provider value={scope}>
          {children}
        </PluginScopeContext.Provider>
      </Suspense>
    </ErrorBoundary>
  );
}
