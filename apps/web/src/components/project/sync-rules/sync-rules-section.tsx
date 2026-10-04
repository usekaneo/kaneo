import { Filter, Pause } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { SyncParams } from "@/fetchers/integration-sync/types";
import { useSyncRules } from "@/hooks/queries/integration-sync/use-sync-rules";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { ResumeSyncDialog } from "./resume-sync-dialog";
import { RuleSummary } from "./rule-summary";
import { SyncRulesEditor } from "./sync-rules-editor";

export function SyncRulesSection({ projectId, provider }: SyncParams) {
  const { t } = useTranslation();
  const advanced = useUserPreferencesStore((state) => state.advancedSettings);
  const { canManageSettings, canUpdateTasks } = useWorkspacePermission();
  const canManage = canManageSettings();
  const canResume = canManage && canUpdateTasks();
  const [pages, setPages] = useState<string[]>([]);
  const [reviewTask, setReviewTask] = useState<{
    taskId: string;
    linkId: string;
  } | null>(null);
  const param = { projectId, provider };
  const query = useSyncRules(param, pages.at(-1));
  const data = query.data;
  if (query.isPending)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {t("settings:syncRules.loading")}
      </p>
    );
  if (query.isError || !data)
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"
      >
        <p className="text-xs text-destructive">
          {t("settings:syncRules.loadError")}
        </p>
        <Button
          size="xs"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          {t("common:error.tryAgain")}
        </Button>
      </div>
    );
  const filtered =
    data.rules.outgoing.mode === "labels" ||
    data.rules.incoming.mode === "labels";
  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card p-4"
      aria-label={t("settings:syncRules.title")}
    >
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Filter aria-hidden="true" className="size-4" />
          {t("settings:syncRules.title")}
          {filtered && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {t("settings:syncRules.filteredBadge")}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("settings:syncRules.sharedHint")}
        </p>
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="font-medium">{t("settings:syncRules.outgoing")}</dt>
          <dd className="break-words text-muted-foreground">
            <RuleSummary
              outgoing
              rule={data.rules.outgoing}
              labels={data.labels}
            />
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="font-medium">{t("settings:syncRules.incoming")}</dt>
          <dd className="break-words text-muted-foreground">
            <RuleSummary
              outgoing={false}
              rule={data.rules.incoming}
              labels={data.labels}
            />
          </dd>
        </div>
      </dl>
      {!data.isActive && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("settings:syncRules.inactiveHint")}
        </p>
      )}
      {data.missingLabels.length > 0 && (
        <p role="alert" className="text-xs text-destructive">
          {t("settings:syncRules.missingLabels")}
        </p>
      )}
      {advanced && canManage ? (
        <SyncRulesEditor
          key={`${projectId}:${provider}`}
          param={param}
          saved={data}
        />
      ) : !advanced && canManage ? (
        <p className="text-xs text-muted-foreground">
          {t("settings:syncRules.advancedHint")}
        </p>
      ) : null}
      {data.paused > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Pause aria-hidden="true" className="size-4" />
            {t("settings:syncRules.pausedCount", { count: data.paused })}
          </p>
          <p className="text-xs text-muted-foreground">
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
                {task.eligible && data.isActive && canResume && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setReviewTask({ taskId: task.id, linkId: task.linkId })
                    }
                  >
                    {t("settings:syncRules.review")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {(pages.length > 0 || data.pausedNextCursor) && (
            <div className="flex gap-2">
              <Button
                size="xs"
                variant="outline"
                disabled={!pages.length || query.isPlaceholderData}
                onClick={() => setPages((current) => current.slice(0, -1))}
              >
                {t("settings:syncRules.previous")}
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={!data.pausedNextCursor || query.isPlaceholderData}
                onClick={() => {
                  if (data.pausedNextCursor)
                    setPages((current) => [...current, data.pausedNextCursor!]);
                }}
              >
                {t("settings:syncRules.next")}
              </Button>
            </div>
          )}
        </div>
      )}
      {reviewTask && (
        <ResumeSyncDialog
          param={param}
          linkId={reviewTask.linkId}
          taskId={reviewTask.taskId}
          onClose={() => setReviewTask(null)}
        />
      )}
    </section>
  );
}
