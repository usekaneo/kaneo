import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type MyTasksPaginationProps = {
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  onLoadMore: () => void;
};

export function MyTasksPagination({
  hasMore,
  loading,
  error,
  onLoadMore,
}: MyTasksPaginationProps) {
  const { t } = useTranslation();
  if (!hasMore && !error) return null;
  return (
    <div className="flex flex-col items-start gap-2 px-5 pb-4">
      {error && (
        <p role="alert" className="text-sm text-muted-foreground">
          {t("workspace:myWork.loadError")}
        </p>
      )}
      {hasMore && (
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={onLoadMore}
        >
          {loading
            ? t("common:empty.loading")
            : error
              ? t("common:error.tryAgain")
              : t("workspace:myTasks.loadMore")}
        </Button>
      )}
    </div>
  );
}
