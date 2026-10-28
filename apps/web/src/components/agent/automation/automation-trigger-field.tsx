import { Clock, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type {
  AutomationDraft,
  AutomationTriggerType,
} from "./automation-draft";
import { AutomationEventFields } from "./automation-event-fields";
import { AutomationScheduleFields } from "./automation-schedule-fields";
import type { AutomationDraftErrors } from "./validate-automation-draft";

type AutomationTriggerFieldProps = {
  workspaceId: string;
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
  errors: AutomationDraftErrors;
};

export function AutomationTriggerField({
  workspaceId,
  draft,
  onChange,
  errors,
}: AutomationTriggerFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <Label id="automation-trigger-label">
        {t("agent:automations.form.trigger")}
      </Label>
      <Tabs
        value={draft.triggerType}
        onValueChange={(value: AutomationTriggerType) =>
          onChange({ triggerType: value })
        }
        className="gap-3"
      >
        <TabsList aria-labelledby="automation-trigger-label" className="w-full">
          <TabsTab value="schedule">
            <Clock aria-hidden="true" />
            {t("agent:automations.form.schedule")}
          </TabsTab>
          <TabsTab value="event">
            <Zap aria-hidden="true" />
            {t("agent:automations.form.eventTab")}
          </TabsTab>
        </TabsList>
        <TabsPanel value="schedule">
          <AutomationScheduleFields
            draft={draft}
            onChange={onChange}
            errors={errors}
          />
        </TabsPanel>
        <TabsPanel value="event">
          <AutomationEventFields
            workspaceId={workspaceId}
            draft={draft}
            onChange={onChange}
          />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
