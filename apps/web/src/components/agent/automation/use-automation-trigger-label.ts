import { useTranslation } from "react-i18next";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import type { Automation } from "@/types/agent-automation";
import { describeAutomationTrigger } from "./describe-automation-trigger";

// Describes triggers in the reader's locale, naming filtered projects.
export function useAutomationTriggerLabel(workspaceId: string) {
  const { t, i18n } = useTranslation();
  const { data: projects } = useGetProjects({ workspaceId });
  const locale = i18n.resolvedLanguage || i18n.language;
  return (trigger: Automation["trigger"]) =>
    describeAutomationTrigger(
      trigger,
      t,
      locale,
      (id) => projects?.find((project) => project.id === id)?.name,
    );
}
