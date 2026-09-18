import { createFileRoute } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityView } from "@/components/activity-tracking/activity-view";
import { AttendanceMonth } from "@/components/attendance/attendance-month";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { PersonPay } from "@/components/pay/person-pay";
import { EditPersonDialog } from "@/components/people/edit-person-dialog";
import { personStatusLabel, roleLabel } from "@/components/people/labels";
import { PersonDevices } from "@/components/people/person-devices";
import { PersonOverview } from "@/components/people/person-overview";
import { PersonTasks } from "@/components/people/person-tasks";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { TimesheetView } from "@/components/time/timesheet-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import usePerson from "@/hooks/queries/people/use-person";
import usePersonTasks from "@/hooks/queries/people/use-person-tasks";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getInitials } from "@/lib/get-initials";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/people/$userId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, userId } = Route.useParams();
  const { data: person, isError } = usePerson(workspaceId, userId);
  const { data: tasks = [] } = usePersonTasks(workspaceId, userId);
  const {
    canManagePeople,
    canSeeActivity: canSeeAllActivity,
    canSeePay: canSeeAllPay,
  } = useWorkspacePermission();
  const { user } = useAuth();
  // Activity is personal: yours, or anyone's with activity:read_all.
  const canSeeActivity = user?.id === userId || Boolean(canSeeAllActivity());
  // Pay is private: your own, or with payroll access.
  const canSeePay = user?.id === userId || Boolean(canSeeAllPay());
  const [isEditing, setIsEditing] = useState(false);

  const title = person?.name ?? t("people:pageTitle");

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout
        title={title}
        headerActions={
          person && canManagePeople() ? (
            <Button
              variant="outline"
              size="xs"
              className="gap-1"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3" />
              {t("people:edit.button")}
            </Button>
          ) : null
        }
      >
        {isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("people:notAvailableTitle")}</EmptyTitle>
              <EmptyDescription>
                {t("people:notAvailableDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : person ? (
          <div className="space-y-6 p-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarImage src={person.image ?? ""} alt={person.name} />
                <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold">
                    {person.name}
                  </h1>
                  <Badge variant="secondary">{roleLabel(t, person.role)}</Badge>
                  {person.status !== "active" && (
                    <Badge variant="warning">
                      {personStatusLabel(t, person.status)}
                    </Badge>
                  )}
                  {person.clockedIn ? (
                    <Badge variant="success">
                      {t("people:status.clockedIn")}
                    </Badge>
                  ) : person.online ? (
                    <Badge variant="outline">{t("people:status.online")}</Badge>
                  ) : null}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {[person.title, person.departmentName]
                    .filter(Boolean)
                    .join(" · ") || person.email}
                </p>
              </div>
            </div>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">
                  {t("people:tabs.overview")}
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  {t("people:tabs.tasks")}
                </TabsTrigger>
                <TabsTrigger value="time">{t("people:tabs.time")}</TabsTrigger>
                <TabsTrigger value="attendance">
                  {t("people:tabs.attendance")}
                </TabsTrigger>
                {canSeeActivity && (
                  <TabsTrigger value="activity">
                    {t("people:tabs.activity")}
                  </TabsTrigger>
                )}
                {canSeePay && (
                  <TabsTrigger value="pay">{t("people:tabs.pay")}</TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="overview" className="pt-4">
                <div className="space-y-8">
                  <PersonOverview person={person} tasks={tasks} />
                  {(user?.id === userId || canManagePeople()) && (
                    <PersonDevices workspaceId={workspaceId} userId={userId} />
                  )}
                </div>
              </TabsContent>
              <TabsContent value="tasks" className="pt-4">
                <PersonTasks workspaceId={workspaceId} tasks={tasks} />
              </TabsContent>
              <TabsContent value="time" className="-mx-4 pt-0">
                <TimesheetView workspaceId={workspaceId} userId={userId} />
              </TabsContent>
              <TabsContent value="attendance" className="pt-4">
                <AttendanceMonth workspaceId={workspaceId} userId={userId} />
              </TabsContent>
              {canSeeActivity && (
                <TabsContent value="activity" className="pt-4">
                  <ActivityView workspaceId={workspaceId} userId={userId} />
                </TabsContent>
              )}
              {canSeePay && (
                <TabsContent value="pay" className="pt-4">
                  <PersonPay
                    workspaceId={workspaceId}
                    userId={userId}
                    name={person.name}
                  />
                </TabsContent>
              )}
            </Tabs>

            <EditPersonDialog
              open={isEditing}
              onClose={() => setIsEditing(false)}
              workspaceId={workspaceId}
              person={person}
            />
          </div>
        ) : null}
      </WorkspaceLayout>
    </>
  );
}
