import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import useUpdateAutomation from "@/hooks/mutations/agent-automation/use-update-automation";
import { toast } from "@/lib/toast";
import type { Automation } from "@/types/agent-automation";
import { automationToDraft, draftToAutomationInput } from "./automation-draft";
import { AutomationForm } from "./automation-form";
import { getAutomationErrorKey } from "./get-automation-error-key";
import { getBrowserTimeZone } from "./list-time-zones";
import { useAutomationsBreadcrumbs } from "./use-automations-breadcrumbs";

export function AutomationEditForm({
  workspaceId,
  automation,
}: {
  workspaceId: string;
  automation: Automation;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const parents = useAutomationsBreadcrumbs(workspaceId);
  const update = useUpdateAutomation(workspaceId);
  // Later refetches must not overwrite edits in progress.
  const [initialDraft] = useState(() =>
    automationToDraft(automation, getBrowserTimeZone()),
  );
  const detail = (
    <Link
      to="/dashboard/workspace/$workspaceId/agent/automations/$automationId"
      params={{ workspaceId, automationId: automation.id }}
    />
  );

  return (
    <AutomationForm
      workspaceId={workspaceId}
      pageTitle={t("agent:automations.editTitle")}
      parents={[...parents, { label: automation.name, link: detail }]}
      cancelLink={detail}
      initialDraft={initialDraft}
      owner={automation.owner}
      submitLabel={t("agent:automations.form.save")}
      pending={update.isPending}
      onSubmit={(draft) =>
        update.mutate(
          { automationId: automation.id, input: draftToAutomationInput(draft) },
          {
            onSuccess: () => {
              toast.success(t("agent:automations.savedToast"));
              void navigate({
                to: "/dashboard/workspace/$workspaceId/agent/automations/$automationId",
                params: { workspaceId, automationId: automation.id },
              });
            },
            onError: (error) => toast.error(t(getAutomationErrorKey(error))),
          },
        )
      }
    />
  );
}
