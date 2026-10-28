import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import useSetAutomationEnabled from "@/hooks/mutations/agent-automation/use-set-automation-enabled";
import { toast } from "@/lib/toast";
import { getAutomationErrorKey } from "./get-automation-error-key";

type AutomationEnabledSwitchProps = {
  workspaceId: string;
  automation: { id: string; name: string; enabled: boolean };
  className?: string;
};

// The hook updates cached lists and details optimistically and rolls back
// on failure, so the switch just reflects cached state.
export function AutomationEnabledSwitch({
  workspaceId,
  automation,
  className,
}: AutomationEnabledSwitchProps) {
  const { t } = useTranslation();
  const toggle = useSetAutomationEnabled(workspaceId, automation.id);

  return (
    <Switch
      className={className}
      checked={automation.enabled}
      disabled={toggle.isPending}
      aria-label={t("agent:automations.enabledLabel", {
        name: automation.name,
      })}
      onCheckedChange={(enabled) =>
        toggle.mutate(enabled, {
          onError: (error) => toast.error(t(getAutomationErrorKey(error))),
        })
      }
    />
  );
}
