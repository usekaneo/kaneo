import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import useGetWorkspaceActivities from "@/hooks/queries/activity/use-get-workspace-activities";
import { ActivityFeedItem } from "./activity-feed-item";
import { SectionHeader } from "./section-header";

type ActivityFeedProps = {
  workspaceId: string;
};

const VISIBLE_ACTIVITIES = 8;

export function ActivityFeed({ workspaceId }: ActivityFeedProps) {
  const { t } = useTranslation();
  const {
    data: activities,
    isLoading,
    isError,
  } = useGetWorkspaceActivities(workspaceId);

  return (
    <section>
      <SectionHeader title={t("workspace:home.activity.title")} />

      {isLoading ? (
        <div className="flex flex-col gap-4 pt-4">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex gap-2.5">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isError && !activities ? (
        <p role="alert" className="py-6 text-muted-foreground text-sm">
          {t("workspace:home.activity.loadError")}
        </p>
      ) : !activities?.length ? (
        <p className="py-6 text-muted-foreground text-sm">
          {t("workspace:home.activity.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4 pt-4">
          {activities.slice(0, VISIBLE_ACTIVITIES).map((activity) => (
            <ActivityFeedItem
              key={activity.id}
              activity={activity}
              workspaceId={workspaceId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
