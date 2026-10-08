import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { CalendarFeedSettings } from "@/components/project/calendar-feed-settings";
import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/calendar",
)({ component: CalendarSettings });

function CalendarSettings() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  return (
    <>
      <PageTitle title={t("settings:calendarFeeds.title")} />
      <SettingsPage
        title={t("settings:calendarFeeds.title")}
        description={t("settings:calendarFeeds.subtitle")}
      >
        <CalendarFeedSettings key={projectId} projectId={projectId} />
      </SettingsPage>
    </>
  );
}
