import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type {
  SyncParams,
  SyncPreview,
} from "@/fetchers/integration-sync/types";
import { useSaveSyncRules } from "@/hooks/mutations/integration-sync/use-save-sync-rules";
import { useSyncPreview } from "@/hooks/queries/integration-sync/use-sync-preview";
import { toast } from "@/lib/toast";
import { LabelRuleEditor } from "./label-rule-editor";

export function SyncRulesEditor({
  param,
  saved,
}: {
  param: SyncParams;
  saved: SyncPreview;
}) {
  const { t } = useTranslation();
  const [rules, setRules] = useState(saved.rules);
  const [previousSavedRules, setPreviousSavedRules] = useState(saved.rules);
  const save = useSaveSyncRules(param);
  const rulesKey = JSON.stringify(rules);
  const savedKey = JSON.stringify(saved.rules);
  const previousSavedKey = JSON.stringify(previousSavedRules);
  const dirty = rulesKey !== previousSavedKey;
  const savedChanged = savedKey !== previousSavedKey;
  if (savedChanged && (!dirty || rulesKey === savedKey)) {
    setRules(saved.rules);
    setPreviousSavedRules(saved.rules);
  }
  const resetDraft = () => {
    setRules(saved.rules);
    setPreviousSavedRules(saved.rules);
    save.reset();
  };
  const valid = [rules.outgoing, rules.incoming].every(
    (rule) => rule.mode === "all" || rule.labels.length > 0,
  );
  const pendingExports = saved.isActive && saved.willCreate > 0;
  const preview = useSyncPreview(
    param,
    rules,
    (dirty || pendingExports) && valid,
  );
  const impact = dirty ? preview.data : saved;
  return (
    <div className="space-y-5 border-t border-border pt-5">
      {savedChanged && dirty && (
        <div role="alert" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("settings:syncRules.rulesChanged")}
          </p>
          <Button
            variant="outline"
            size="xs"
            disabled={save.isPending}
            onClick={resetDraft}
          >
            {t("settings:syncRules.loadSavedRules")}
          </Button>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <LabelRuleEditor
          direction="outgoing"
          rule={rules.outgoing}
          labels={saved.labels}
          onChange={(outgoing) => {
            save.reset();
            setRules((current) => ({ ...current, outgoing }));
          }}
        />
        <LabelRuleEditor
          direction="incoming"
          rule={rules.incoming}
          labels={saved.labels}
          onChange={(incoming) => {
            save.reset();
            setRules((current) => ({ ...current, incoming }));
          }}
        />
      </div>
      {valid && impact && (
        <div
          className="space-y-3 rounded-lg border border-border bg-background p-3"
          aria-live="polite"
        >
          <p className="text-sm font-medium">
            {t("settings:syncRules.impactTitle")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("settings:syncRules.impact", {
              matching: impact.matching,
              total: impact.total,
              create: impact.willCreate,
              pause: impact.willPause,
              review: impact.needsReview,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("settings:syncRules.preserveHint")}
          </p>
          {impact.matchingTasks.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {impact.matchingTasks.map((task) => (
                <li key={task.id} className="truncate">
                  {task.number !== null ? `#${task.number} · ` : ""}
                  {task.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {preview.isFetching && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("settings:syncRules.previewing")}
        </p>
      )}
      {(preview.isError || save.isError) && (
        <div role="alert" className="space-y-2">
          <p className="text-xs text-destructive">
            {t("settings:syncRules.saveError")}
          </p>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              save.reset();
              void preview.refetch();
            }}
          >
            {t("settings:syncRules.refreshPreview")}
          </Button>
        </div>
      )}
      {impact?.missingLabels.length ? (
        <p role="alert" className="text-xs text-destructive">
          {t("settings:syncRules.missingLabels")}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          loading={save.isPending}
          disabled={
            (!dirty && !pendingExports) ||
            !valid ||
            !preview.data ||
            preview.isFetching ||
            preview.isError ||
            !!preview.data.missingLabels.length
          }
          onClick={() => {
            if (preview.data)
              save.mutate(
                { rules, previewToken: preview.data.previewToken },
                {
                  onSuccess: () => toast.success(t("settings:syncRules.saved")),
                },
              );
          }}
        >
          {!dirty && pendingExports
            ? t("settings:syncRules.exportPending")
            : t("settings:syncRules.apply")}
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            disabled={save.isPending}
            onClick={resetDraft}
          >
            {t("common:actions.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}
