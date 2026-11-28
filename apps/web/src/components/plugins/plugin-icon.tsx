import type { IconComponent } from "@kaneo/plugin-sdk/web";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { PluginIconFallback } from "./plugin-icon-fallback";

type PluginIconProps = {
  icon: IconComponent | undefined;
  className?: string;
};

function BrokenIcon() {
  return <PluginIconFallback />;
}

export function PluginIcon({
  icon: Icon,
  className = "size-3.5",
}: PluginIconProps) {
  if (!Icon) return <PluginIconFallback className={className} />;

  return (
    <ErrorBoundary fallback={BrokenIcon}>
      <Icon className={className} />
    </ErrorBoundary>
  );
}
