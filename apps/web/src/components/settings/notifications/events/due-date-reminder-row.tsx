import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { Switch } from "@/components/ui/switch";
import {
  getLeadTimeMax,
  getValidLeadTimeMinutes,
  type LeadTime,
} from "./lead-time";
import { LeadTimeControls } from "./lead-time-controls";

type DueDateReminderRowProps = {
  enabled: boolean;
  leadTime: LeadTime;
  onEnabledChange: (enabled: boolean) => void;
  onLeadTimeChange: (leadTime: LeadTime) => void;
};

export function DueDateReminderRow({
  enabled,
  leadTime,
  onEnabledChange,
  onLeadTimeChange,
}: DueDateReminderRowProps) {
  const { t } = useTranslation();
  const title = t("settings:notificationsPage.eventDueDateReminders");
  const invalid = enabled && getValidLeadTimeMinutes(leadTime) === null;

  return (
    <SettingsRow
      stack
      title={title}
      description={
        <>
          <p>{t("settings:notificationsPage.eventDueDateRemindersHint")}</p>
          {invalid ? (
            <p className="mt-1 text-destructive-foreground" role="alert">
              {t("settings:notificationsPage.reminderLeadTimeInvalid", {
                max: getLeadTimeMax(leadTime.unit),
              })}
            </p>
          ) : null}
        </>
      }
    >
      <LeadTimeControls
        disabled={!enabled}
        invalid={invalid}
        leadTime={leadTime}
        onChange={onLeadTimeChange}
      />
      <Switch
        aria-label={title}
        checked={enabled}
        onCheckedChange={onEnabledChange}
      />
    </SettingsRow>
  );
}
