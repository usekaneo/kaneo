import { useTranslation } from "react-i18next";
import { AutosaveNote } from "@/components/settings/autosave-note";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { DueDateReminderRow } from "./due-date-reminder-row";
import { EventSwitchRow } from "./event-switch-row";
import { useEventPreferencesAutosave } from "./use-event-preferences-autosave";

type NotifyMeSectionProps = {
  preferences: NotificationPreferences;
};

export function NotifyMeSection({ preferences }: NotifyMeSectionProps) {
  const { t } = useTranslation();
  const { state, setSwitch, setLeadTime } =
    useEventPreferencesAutosave(preferences);

  return (
    <SettingsSection
      title={t("settings:notificationsPage.eventPreferencesTitle")}
      description={t("settings:notificationsPage.eventPreferencesDescription")}
      action={<AutosaveNote />}
    >
      <SettingsCard>
        <EventSwitchRow
          title={t("settings:notificationsPage.eventTaskAssignments")}
          description={t("settings:notificationsPage.eventTaskAssignmentsHint")}
          checked={state.taskAssignmentEnabled}
          onCheckedChange={(checked) =>
            setSwitch("taskAssignmentEnabled", checked)
          }
        />
        <EventSwitchRow
          title={t("settings:notificationsPage.eventComments")}
          description={t("settings:notificationsPage.eventCommentsHint")}
          checked={state.taskCommentEnabled}
          onCheckedChange={(checked) =>
            setSwitch("taskCommentEnabled", checked)
          }
        />
        <EventSwitchRow
          title={t("settings:notificationsPage.eventStatusChanges")}
          description={t("settings:notificationsPage.eventStatusChangesHint")}
          checked={state.taskStatusChangeEnabled}
          onCheckedChange={(checked) =>
            setSwitch("taskStatusChangeEnabled", checked)
          }
        />
        <DueDateReminderRow
          enabled={state.dueDateReminderEnabled}
          leadTime={state.leadTime}
          onEnabledChange={(checked) =>
            setSwitch("dueDateReminderEnabled", checked)
          }
          onLeadTimeChange={setLeadTime}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
