import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AttendanceMonth } from "@/components/attendance/attendance-month";
import { TeamAttendanceDay } from "@/components/attendance/team-attendance-day";
import { TodayCard, zoneOffsetLabel } from "@/components/attendance/today-card";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { LeaveBoard } from "@/components/requests/leave-board";
import { MyLeave } from "@/components/requests/my-leave";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import { useOpenRequests } from "@/hooks/queries/company-os";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

const TABS = ["me", "team", "leave"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/attendance",
)({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => ({
    tab: TABS.includes(search.tab as Tab) ? (search.tab as Tab) : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { tab = "me" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { canSeePeople, canApproveRequests } = useWorkspacePermission();
  const seeTeam = Boolean(canSeePeople());
  const canApprove = Boolean(canApproveRequests());
  const { data: company } = useCompanySettings(workspaceId);
  const { data: open } = useOpenRequests(workspaceId, canApprove);
  const waiting = open?.leave.length ?? 0;
  const timeZone = company?.timezone;

  const current: Tab =
    (tab === "team" && !seeTeam) || (tab === "leave" && !canApprove)
      ? "me"
      : tab;

  return (
    <>
      <PageTitle title={t("attendance:page.title")} />
      <WorkspaceLayout
        title={t("attendance:page.title")}
        headerActions={
          timeZone ? (
            <span
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs sm:flex"
              title={t("attendance:page.timezoneHint")}
            >
              <Globe className="size-3" />
              {timeZone.replace(/_/g, " ")} · {zoneOffsetLabel(timeZone)}
            </span>
          ) : null
        }
      >
        <Tabs
          value={current}
          onValueChange={(value) =>
            navigate({ search: value === "me" ? {} : { tab: value as Tab } })
          }
          className="pt-4"
        >
          {/* One tab is no choice; members just see their page. */}
          <TabsList className={seeTeam || canApprove ? "mx-4" : "hidden"}>
            <TabsTrigger value="me">{t("attendance:page.me")}</TabsTrigger>
            {seeTeam && (
              <TabsTrigger value="team">
                {t("attendance:page.team")}
              </TabsTrigger>
            )}
            {canApprove && (
              <TabsTrigger value="leave">
                {t("attendance:page.leave")}
                {waiting > 0 && (
                  <span className="ms-1.5 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular-nums">
                    {waiting}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="me" className="space-y-6 p-4">
            <TodayCard workspaceId={workspaceId} />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <AttendanceMonth workspaceId={workspaceId} />
              <div>
                <MyLeave workspaceId={workspaceId} />
              </div>
            </div>
          </TabsContent>
          {seeTeam && (
            <TabsContent value="team" className="p-4">
              <TeamAttendanceDay workspaceId={workspaceId} />
            </TabsContent>
          )}
          {canApprove && (
            <TabsContent value="leave" className="p-4">
              <LeaveBoard workspaceId={workspaceId} />
            </TabsContent>
          )}
        </Tabs>
      </WorkspaceLayout>
    </>
  );
}
