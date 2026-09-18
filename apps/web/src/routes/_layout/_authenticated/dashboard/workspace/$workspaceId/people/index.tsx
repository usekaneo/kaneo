import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Approvals } from "@/components/requests/approvals";
import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import MembersTable from "@/components/team/members-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpenRequests } from "@/hooks/queries/company-os";
import usePeople from "@/hooks/queries/people/use-people";
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
  const { canInviteUsers, canSeePeople, canApproveRequests } =
    useWorkspacePermission();
  const canApprove = Boolean(canApproveRequests());
  const { data: open } = useOpenRequests(workspaceId, canApprove);
  const waiting =
    (open?.leave.length ?? 0) +
    (open?.expenses.filter((e) => e.status === "pending").length ?? 0);
  const canInvite = Boolean(canInviteUsers());
  const seeEveryone = Boolean(canSeePeople());
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const byUser = useMemo(
    () => new Map(people.map((person) => [person.userId, person])),
    [people],
  );

  const table = (
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
    />
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

        <InviteTeamMemberModal
          open={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
        />
      </WorkspaceLayout>
    </>
  );
}
