import { SettingsCard } from "@/components/settings/settings-card";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["a", "b", "c", "d"];

export function ColumnListSkeleton() {
  return (
    <SettingsCard aria-busy="true">
      <div className="h-8" />
      {ROWS.map((row) => (
        <div key={row} className="flex h-12 items-center gap-2.5 px-4">
          <Skeleton className="size-3.5" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 w-32" />
          <span className="flex-1" />
          <Skeleton className="h-4 w-7 rounded-full" />
          <span className="w-7" />
        </div>
      ))}
    </SettingsCard>
  );
}
