import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { CalendarFeedSettings } from "@/components/project/calendar-feed-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/calendar",
)({ component: CalendarSettings });

function CalendarSettings() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  return (
    <>
      <PageTitle title={t("settings:calendarFeeds.title")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:calendarFeeds.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:calendarFeeds.subtitle")}
          </p>
        </div>
        <CalendarFeedSettings key={projectId} projectId={projectId} />
      </div>
    </>
  );
}
