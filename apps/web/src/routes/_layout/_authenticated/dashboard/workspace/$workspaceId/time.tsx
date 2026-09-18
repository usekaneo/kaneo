import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ActivityView } from "@/components/activity-tracking/activity-view";
import { AttendanceMonth } from "@/components/attendance/attendance-month";
import { TeamAttendanceDay } from "@/components/attendance/team-attendance-day";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { TimesheetView } from "@/components/time/timesheet-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/time",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { canSeePeople } = useWorkspacePermission();

  return (
    <>
      <PageTitle title={t("time:sheet.title")} />
      <WorkspaceLayout title={t("navigation:sidebar.time")}>
        <Tabs defaultValue="time" className="pt-4">
          <TabsList className="mx-4">
            <TabsTrigger value="time">{t("time:tabs.time")}</TabsTrigger>
            <TabsTrigger value="attendance">
              {t("time:tabs.attendance")}
            </TabsTrigger>
            <TabsTrigger value="activity">
              {t("time:tabs.activity")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="time">
            <TimesheetView workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="attendance" className="p-4">
            {canSeePeople() ? (
              <TeamAttendanceDay workspaceId={workspaceId} />
            ) : (
              <AttendanceMonth workspaceId={workspaceId} />
            )}
          </TabsContent>
          <TabsContent value="activity" className="p-4">
            <ActivityView workspaceId={workspaceId} />
          </TabsContent>
        </Tabs>
      </WorkspaceLayout>
    </>
  );
}
