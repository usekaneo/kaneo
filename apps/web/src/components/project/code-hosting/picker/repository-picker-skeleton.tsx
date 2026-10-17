import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["first", "second", "third", "fourth"];

export function RepositoryPickerSkeleton() {
  const { t } = useTranslation();

  return (
    <ul
      role="status"
      aria-label={t("common:empty.loading")}
      className="space-y-1"
    >
      {ROWS.map((row) => (
        <li key={row} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="size-3.5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
