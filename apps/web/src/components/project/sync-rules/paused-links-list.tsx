import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { SyncPreview } from "@/fetchers/integration-sync/types";

type PausedLinksListProps = {
  data: SyncPreview;
  canResume: boolean;
  hasPrevious: boolean;
  loadingPage: boolean;
  onReview: (task: { taskId: string; linkId: string }) => void;
  onPrevious: () => void;
  onNext: (cursor: string) => void;
};

export function PausedLinksList({
  data,
  canResume,
  hasPrevious,
  loadingPage,
  onReview,
  onPrevious,
  onNext,
}: PausedLinksListProps) {
  const { t } = useTranslation();
  const nextCursor = data.pausedNextCursor;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background px-3 py-2">
      <p className="py-1 text-xs text-muted-foreground">
        {t("settings:syncRules.pausedHint")}
      </p>
      <ul className="divide-y divide-border">
        {data.pausedTasks.map((task) => (
          <li
            key={task.linkId}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <a
                className="block truncate text-sm hover:underline"
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {task.title}
              </a>
              <p className="text-xs text-muted-foreground">
                {task.eligible
                  ? t("settings:syncRules.reviewRequired")
                  : t("settings:syncRules.excluded")}
              </p>
            </div>
            {task.eligible && data.isActive && canResume ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onReview({ taskId: task.id, linkId: task.linkId })
                }
              >
                {t("settings:syncRules.review")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {hasPrevious || nextCursor ? (
        <div className="flex justify-end gap-2 pb-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasPrevious || loadingPage}
            onClick={onPrevious}
          >
            {t("settings:syncRules.previous")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!nextCursor || loadingPage}
            onClick={() => {
              if (nextCursor) onNext(nextCursor);
            }}
          >
            {t("settings:syncRules.next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
