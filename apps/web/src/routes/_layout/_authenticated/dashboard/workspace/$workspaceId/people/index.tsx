import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { AddSalaryDialog } from "@/components/pay/add-salary-dialog";
import { PeopleSummary } from "@/components/people/people-summary";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Approvals } from "@/components/requests/approvals";
import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import MembersTable from "@/components/team/members-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCurrentSalaries,
  useOpenRequests,
} from "@/hooks/queries/company-os";
import usePeople from "@/hooks/queries/people/use-people";
import usePeopleOverview from "@/hooks/queries/people/use-people-overview";
import useGetFullWorkspace from "@/hooks/queries/workspace/use-get-full-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/people/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: workspace } = useGetFullWorkspace({ workspaceId });
  const { data: people = [] } = usePeople(workspaceId);
  const {
    canInviteUsers,
    canSeePeople,
    canApproveRequests,
    canSeePay,
    canManagePay,
  } = useWorkspacePermission();
  const canApprove = Boolean(canApproveRequests());
  const { data: open } = useOpenRequests(workspaceId, canApprove);
  const waiting =
    (open?.leave.length ?? 0) +
    (open?.expenses.filter((e) => e.status === "pending").length ?? 0);
  const canInvite = Boolean(canInviteUsers());
  const seeEveryone = Boolean(canSeePeople());
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const seePay = seeEveryone && Boolean(canSeePay());
  const managePay = Boolean(canManagePay());
  const { data: overview } = usePeopleOverview(workspaceId, seeEveryone);
  const { data: salaries } = useCurrentSalaries(workspaceId, seePay);
  const [salaryFor, setSalaryFor] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const statsByUser = useMemo(
    () => new Map((overview?.people ?? []).map((p) => [p.userId, p])),
    [overview],
  );
  const salaryByUser = useMemo(
    () => (salaries ? new Map(salaries.map((s) => [s.userId, s])) : undefined),
    [salaries],
  );
  const pendingInvites = (workspace?.invitations ?? []).filter(
    (inv) => inv.status !== "accepted" && inv.status !== "canceled",
  ).length;

  const byUser = useMemo(
    () => new Map(people.map((person) => [person.userId, person])),
    [people],
  );

  const table = (
    <div className="space-y-4">
      {overview && (
        <div className="px-4 pt-2">
          <PeopleSummary
            people={people}
            overview={overview}
            salaries={seePay ? salaries : undefined}
            pendingInvites={pendingInvites}
          />
        </div>
      )}
      <MembersTable
        workspaceId={workspaceId}
        users={workspace?.members ?? []}
        invitations={workspace?.invitations ?? []}
        people={byUser}
        canOpenPerson={(userId) => seeEveryone || userId === user?.id}
        onOpenPerson={(userId) =>
          navigate({
            to: "/dashboard/workspace/$workspaceId/people/$userId",
            params: { workspaceId, userId },
          })
        }
        admin={
          overview
            ? {
                stats: statsByUser,
                leaveAllowance: overview.leaveAllowance,
                currency: overview.currency,
                salaries: seePay ? salaryByUser : undefined,
                onEditSalary: managePay
                  ? (userId, name) => setSalaryFor({ userId, name })
                  : undefined,
              }
            : undefined
        }
      />
    </div>
  );

  return (
    <>
      <PageTitle title={t("people:pageTitle")} />
      <WorkspaceLayout
        title={t("people:pageTitle")}
        headerActions={
          canInvite ? (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsInviteOpen(true)}
              className="gap-1"
            >
              <UserPlus className="w-3 h-3" />
              {t("team:members.inviteMember")}
            </Button>
          ) : null
        }
      >
        {canApprove ? (
          <Tabs defaultValue="people" className="pt-4">
            <TabsList className="mx-4">
              <TabsTrigger value="people">
                {t("people:tabs.people")}
              </TabsTrigger>
              <TabsTrigger value="requests">
                {t("people:tabs.requests")}
                {waiting > 0 && (
                  <span className="ms-1.5 rounded-sm border border-border px-1 text-[11px] tabular-nums">
                    {waiting}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="people">{table}</TabsContent>
            <TabsContent value="requests" className="p-4">
              <Approvals workspaceId={workspaceId} />
            </TabsContent>
          </Tabs>
        ) : (
          table
        )}

        {salaryFor && overview && (
          <AddSalaryDialog
            open
            onClose={() => setSalaryFor(null)}
            workspaceId={workspaceId}
            userId={salaryFor.userId}
            name={salaryFor.name}
            currency={overview.currency}
          />
        )}

        <InviteTeamMemberModal
          open={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
        />
      </WorkspaceLayout>
    </>
  );
}
