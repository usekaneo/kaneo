import type { IconComponent } from "@kaneo/plugin-sdk/web";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PluginIconFallback } from "./plugin-icon-fallback";

type PluginIconProps = {
  icon: IconComponent | undefined;
};

export function PluginIcon({ icon: Icon }: PluginIconProps) {
  if (!Icon) return <PluginIconFallback />;

  return (
    <ErrorBoundary fallback={PluginIconFallback}>
      <Icon className="size-3.5" />
    </ErrorBoundary>
  );
}
