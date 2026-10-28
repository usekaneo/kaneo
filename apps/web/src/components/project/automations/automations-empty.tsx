import { Link } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { buttonVariants } from "@/components/ui/button";

export function AutomationsEmpty({ projectId }: { projectId: string }) {
  const { t } = useTranslation();

  return (
    <SettingsCard>
      <SettingsEmpty
        icon={<Workflow />}
        title={t("settings:workflowEditor.emptyTitle")}
        description={t("settings:workflowEditor.emptyDescription")}
        action={
          <Link
            to="/dashboard/settings/projects/$projectId/integrations"
            params={{ projectId }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("settings:workflowEditor.openIntegrations")}
          </Link>
        }
      />
    </SettingsCard>
  );
}
