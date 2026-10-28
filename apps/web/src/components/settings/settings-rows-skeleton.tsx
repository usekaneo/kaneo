import { Skeleton } from "@/components/ui/skeleton";

type SettingsRowsSkeletonProps = {
  rows?: number;
  withDescription?: boolean;
};

export function SettingsRowsSkeleton({
  rows = 3,
  withDescription = false,
}: SettingsRowsSkeletonProps) {
  return Array.from({ length: rows }, (_, index) => (
    <div
      key={index}
      aria-hidden="true"
      data-testid="settings-row-skeleton"
      className="flex items-center gap-3.5 px-4 py-3.5"
    >
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        {withDescription ? <Skeleton className="h-3 w-56 max-w-full" /> : null}
      </div>
    </div>
  ));
}
