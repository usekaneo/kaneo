export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col w-full">
      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8 max-w-6xl mx-auto">
            <div className="text-center space-y-4">
              <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-md w-64 mx-auto" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-96 mx-auto" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4"].map(
                (skeletonId) => (
                  <div key={skeletonId} className="space-y-3">
                    <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                    <div className="space-y-2">
                      {["task-1", "task-2", "task-3"].map((taskId) => (
                        <div
                          key={`${skeletonId}-${taskId}`}
                          className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
