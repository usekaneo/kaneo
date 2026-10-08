import type { PluginInfo } from "@kaneo/plugin-sdk/web";
import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PluginScopeContext } from "@/lib/plugins/host/plugin-scope-context";
import { PluginFailedMessage } from "./plugin-failed-message";
import { PluginLoading } from "./plugin-loading";

type PluginBoundaryProps = {
  scope: PluginInfo;
  children: ReactNode;
};

export function PluginBoundary({ scope, children }: PluginBoundaryProps) {
  return (
    <ErrorBoundary
      key={`${scope.id}@${scope.version}`}
      fallback={PluginFailedMessage}
    >
      <Suspense fallback={<PluginLoading />}>
        <PluginScopeContext.Provider value={scope}>
          {children}
        </PluginScopeContext.Provider>
      </Suspense>
    </ErrorBoundary>
  );
}
