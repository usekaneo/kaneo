import { SettingsCard } from "@/components/settings/settings-card";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["a", "b", "c"];

export function CustomFieldListSkeleton() {
  return (
    <SettingsCard aria-busy="true">
      {ROWS.map((row) => (
        <div key={row} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-3.5" />
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      ))}
    </SettingsCard>
  );
}
