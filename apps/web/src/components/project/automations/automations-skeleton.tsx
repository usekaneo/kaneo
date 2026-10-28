import { SettingsCard } from "@/components/settings/settings-card";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["a", "b", "c"];

export function AutomationsSkeleton() {
  return (
    <SettingsCard aria-busy="true">
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <Skeleton className="size-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      {ROWS.map((row) => (
        <div key={row} className="flex items-center gap-6 px-4 py-3.5">
          <Skeleton className="h-4 w-32" />
          <span className="flex-1" />
          <Skeleton className="h-7 w-48 rounded-lg" />
        </div>
      ))}
    </SettingsCard>
  );
}
