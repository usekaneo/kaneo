import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

export function DeliveryPanelSkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status" className="space-y-4 p-4">
      <span className="sr-only">{t("common:empty.loading")}</span>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    </div>
  );
}
