import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import useCreateAutomation from "@/hooks/mutations/agent-automation/use-create-automation";
import { toast } from "@/lib/toast";
import {
  createAutomationDraft,
  draftToAutomationInput,
} from "./automation-draft";
import { AutomationForm } from "./automation-form";
import { getAutomationErrorKey } from "./get-automation-error-key";
import { getBrowserTimeZone } from "./list-time-zones";
import { useAutomationsBreadcrumbs } from "./use-automations-breadcrumbs";

export function AutomationFormPage({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const parents = useAutomationsBreadcrumbs(workspaceId);
  const create = useCreateAutomation(workspaceId);
  const [initialDraft] = useState(() =>
    createAutomationDraft(getBrowserTimeZone()),
  );

  return (
    <AutomationForm
      workspaceId={workspaceId}
      pageTitle={t("agent:automations.newTitle")}
      parents={parents}
      cancelLink={
        <Link
          to="/dashboard/workspace/$workspaceId/agent/automations"
          params={{ workspaceId }}
        />
      }
      initialDraft={initialDraft}
      owner={{
        id: user?.id ?? "",
        name: user?.name ?? "",
        image: user?.image ?? null,
      }}
      submitLabel={t("agent:automations.form.create")}
      pending={create.isPending}
      onSubmit={(draft) =>
        create.mutate(draftToAutomationInput(draft), {
          onSuccess: (automation) => {
            toast.success(t("agent:automations.createdToast"));
            void navigate({
              to: "/dashboard/workspace/$workspaceId/agent/automations/$automationId",
              params: { workspaceId, automationId: automation.id },
            });
          },
          onError: (error) => toast.error(t(getAutomationErrorKey(error))),
        })
      }
    />
  );
}
