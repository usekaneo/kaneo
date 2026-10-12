import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

export function CodeHostingPanelSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-label={t("common:empty.loading")}
      className="space-y-3 p-4"
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-64 max-w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
