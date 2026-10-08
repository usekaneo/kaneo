import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

type PluginLoadingProps = {
  className?: string;
};

export function PluginLoading({ className }: PluginLoadingProps) {
  return (
    <div className={cn("flex items-center py-2", className)}>
      <Spinner className="size-4 text-muted-foreground" />
    </div>
  );
}
