import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { CalendarFeedSettings } from "@/components/project/calendar-feeds/calendar-feed-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/calendar",
)({ component: CalendarSettings });

function CalendarSettings() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("settings:calendarFeeds.title")} />
      <CalendarFeedSettings key={projectId} projectId={projectId} />
    </>
  );
}
