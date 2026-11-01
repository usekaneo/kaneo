import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

export function AutomationsListSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("common:empty.loading")}>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-border/60 border-b py-3.5"
        >
          <div className="flex grow flex-col gap-1.5">
            <Skeleton className="h-3.5 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-4 w-8 rounded-full" />
        </div>
      ))}
    </div>
  );
}
