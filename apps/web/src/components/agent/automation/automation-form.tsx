import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout, {
  type WorkspaceBreadcrumb,
} from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import useAgentConfig from "@/hooks/queries/agent/use-agent-config";
import type { AgentConversationOwner } from "@/types/agent";
import type { AutomationDraft } from "./automation-draft";
import { AutomationDailyLimitField } from "./automation-daily-limit-field";
import { AutomationNameField } from "./automation-name-field";
import { AutomationOutputField } from "./automation-output-field";
import { AutomationPromptField } from "./automation-prompt-field";
import { AutomationRunsAs } from "./automation-runs-as";
import { AutomationScopeSelect } from "./automation-scope-select";
import { AutomationTriggerField } from "./automation-trigger-field";
import { validateAutomationDraft } from "./validate-automation-draft";

type AutomationFormProps = {
  workspaceId: string;
  pageTitle: string;
  parents: WorkspaceBreadcrumb[];
  cancelLink: WorkspaceBreadcrumb["link"];
  initialDraft: AutomationDraft;
  owner: AgentConversationOwner;
  submitLabel: string;
  pending: boolean;
  onSubmit: (draft: AutomationDraft) => void;
};

export function AutomationForm({
  workspaceId,
  pageTitle,
  parents,
  cancelLink,
  initialDraft,
  owner,
  submitLabel,
  pending,
  onSubmit,
}: AutomationFormProps) {
  const { t } = useTranslation();
  const { data: config } = useAgentConfig(workspaceId);
  const [draft, setDraft] = useState(initialDraft);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validateAutomationDraft(draft) : {};
  const update = (patch: Partial<AutomationDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateAutomationDraft(draft)).length > 0) return;
    onSubmit(draft);
  };

  return (
    <>
      <PageTitle title={pageTitle} />
      <WorkspaceLayout
        title={pageTitle}
        parents={parents}
        headerActions={
          <>
            <Button variant="outline" size="xs" render={cancelLink}>
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="automation-form"
              size="xs"
              disabled={pending}
            >
              {submitLabel}
            </Button>
          </>
        }
      >
        <div className="h-full overflow-y-auto">
          <form
            id="automation-form"
            noValidate
            onSubmit={handleSubmit}
            className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-14"
          >
            <div className="pt-4">
              <AutomationNameField
                value={draft.name}
                onValueChange={(name) => update({ name })}
                error={errors.name}
              />
            </div>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-14">
              <AutomationPromptField
                workspaceId={workspaceId}
                projectId={draft.projectId}
                value={draft.prompt}
                onValueChange={(prompt) => update({ prompt })}
                models={config?.models ?? []}
                model={draft.model ?? config?.model ?? null}
                onModelChange={(model) => update({ model })}
                error={errors.prompt}
              />
              <div className="flex flex-col gap-6">
                <AutomationTriggerField
                  workspaceId={workspaceId}
                  draft={draft}
                  onChange={update}
                  errors={errors}
                />
                <Separator />
                <AutomationScopeSelect
                  workspaceId={workspaceId}
                  value={draft.projectId}
                  onValueChange={(projectId) => update({ projectId })}
                />
                <AutomationOutputField
                  value={draft.output}
                  onValueChange={(output) => update({ output })}
                />
                <AutomationDailyLimitField
                  value={draft.dailyRunLimit}
                  onValueChange={(dailyRunLimit) => update({ dailyRunLimit })}
                  error={errors.dailyRunLimit}
                />
                <Separator />
                <AutomationRunsAs owner={owner} isViewer />
              </div>
            </div>
          </form>
        </div>
      </WorkspaceLayout>
    </>
  );
}
