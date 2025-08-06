import { cn } from "@/lib/cn";

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className={cn("flex w-full h-svh bg-sidebar", className)}>
      <div className="w-64 bg-sidebar border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="flex-1">
              <div className="w-20 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex-1 p-3 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="w-16 h-3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            {["dashboard", "projects", "settings"].map((item) => (
              <div
                key={`nav-item-${item}`}
                className="flex items-center gap-2 p-2 rounded"
              >
                <div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="w-20 h-3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="w-16 h-3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="ml-4 space-y-1">
              {["issues", "projects", "views", "settings"].map((item) => (
                <div
                  key={`workspace-item-${item}`}
                  className="flex items-center gap-2 p-1"
                >
                  <div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="w-16 h-3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
            <div className="flex-1">
              <div className="w-20 h-3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-card border border-border rounded-md m-2">
        <div className="h-12 border-b border-border flex items-center px-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="w-32 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse mx-auto" />
            <div className="space-y-2">
              <div className="w-48 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mx-auto" />
              <div className="w-64 h-3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
