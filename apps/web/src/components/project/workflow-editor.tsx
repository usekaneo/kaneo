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

const GITHUB_EVENTS = [
  { eventType: "branch_push", label: "Branch Push" },
  { eventType: "pr_opened", label: "PR Opened" },
  { eventType: "pr_merged", label: "PR Merged" },
  { eventType: "issue_opened", label: "Issue Opened" },
  { eventType: "issue_closed", label: "Issue Closed" },
];

type WorkflowEditorProps = {
  projectId: string;
};

export default function WorkflowEditor({ projectId }: WorkflowEditorProps) {
  const { data: columns, isLoading: columnsLoading } = useGetColumns(projectId);
  const { data: rules, isLoading: rulesLoading } =
    useGetWorkflowRules(projectId);
  const { mutateAsync: upsertRule } = useUpsertWorkflowRule();

  const handleChange = async (eventType: string, columnId: string) => {
    try {
      await upsertRule({
        projectId,
        data: {
          integrationType: "github",
          eventType,
          columnId,
        },
      });
      toast.success("Workflow rule updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update rule",
      );
    }
  };

  if (columnsLoading || rulesLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!columns || columns.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Create columns first to configure automation rules.
      </div>
    );
  }

  const githubRules = rules?.filter((r) => r.integrationType === "github");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">GitHub</h3>
        <p className="text-xs text-muted-foreground">
          When a GitHub event occurs, move the linked task to a column.
        </p>
      </div>

      <div className="space-y-2">
        {GITHUB_EVENTS.map((event) => {
          const currentRule = githubRules?.find(
            (r) => r.eventType === event.eventType,
          );

          return (
            <div
              key={event.eventType}
              className="flex items-center justify-between gap-4 p-3 border border-border rounded-md bg-sidebar"
            >
              <span className="text-sm">{event.label}</span>
              <Select
                value={currentRule?.columnId ?? ""}
                onValueChange={(value) => handleChange(event.eventType, value)}
              >
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder="Select column..." />
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
