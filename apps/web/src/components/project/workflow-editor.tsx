import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpsertWorkflowRule } from "@/hooks/mutations/workflow-rule/use-upsert-workflow-rule";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useGetWorkflowRules } from "@/hooks/queries/workflow-rule/use-get-workflow-rules";
import { toast } from "@/lib/toast";

const GITHUB_EVENT_TYPES = [
  "branch_push",
  "pr_opened",
  "pr_merged",
  "issue_opened",
  "issue_closed",
] as const;

type WorkflowEditorProps = {
  projectId: string;
};

export default function WorkflowEditor({ projectId }: WorkflowEditorProps) {
  const { t } = useTranslation();
  const { data: columns, isLoading: columnsLoading } = useGetColumns(projectId);
  const { data: rules, isLoading: rulesLoading } =
    useGetWorkflowRules(projectId);
  const { mutateAsync: upsertRule } = useUpsertWorkflowRule();

  const handleChange = async (eventType: string, columnId: string | null) => {
    if (!columnId) return;

    try {
      await upsertRule({
        projectId,
        data: {
          integrationType: "github",
          eventType,
          columnId,
        },
      });
      toast.success(t("settings:workflowEditor.toastUpdated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workflowEditor.toastError"),
      );
    }
  };

  if (columnsLoading || rulesLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings:workflowEditor.loading")}
      </div>
    );
  }

  if (!columns || columns.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings:workflowEditor.createColumnsFirst")}
      </div>
    );
  }

  const githubRules = rules?.filter((r) => r.integrationType === "github");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">
          {t("settings:workflowEditor.githubHeading")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("settings:workflowEditor.githubHint")}
        </p>
      </div>

      <div className="space-y-2">
        {GITHUB_EVENT_TYPES.map((eventType) => {
          const currentRule = githubRules?.find(
            (r) => r.eventType === eventType,
          );

          return (
            <div
              key={eventType}
              className="flex items-center justify-between gap-4 p-3 border border-border rounded-md bg-sidebar"
            >
              <span className="text-sm">
                {t(`settings:workflowEditor.events.${eventType}`)}
              </span>
              <Select
                value={currentRule?.columnId ?? ""}
                onValueChange={(value) => handleChange(eventType, value)}
              >
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue
                    placeholder={t(
                      "settings:workflowEditor.selectColumnPlaceholder",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
