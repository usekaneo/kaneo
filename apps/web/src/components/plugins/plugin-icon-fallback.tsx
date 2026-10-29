import { Puzzle } from "lucide-react";

type PluginIconFallbackProps = {
  className?: string;
};

export function PluginIconFallback({
  className = "size-3.5",
}: PluginIconFallbackProps) {
  return <Puzzle className={className} />;
}
