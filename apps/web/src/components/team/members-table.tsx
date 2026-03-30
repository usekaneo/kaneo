import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import useCancelInvitation from "@/hooks/mutations/workspace-user/use-cancel-invitation";
import useDeleteWorkspaceUser from "@/hooks/mutations/workspace-user/use-delete-workspace-user";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { Route } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/members";
import type {
  WorkspaceUser,
  WorkspaceUserInvitation,
} from "@/types/workspace-user";
import { useAuth } from "../providers/auth-provider/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

function MembersTable({
  invitations,
  users,
}: {
  invitations: WorkspaceUserInvitation[];
  users: WorkspaceUser[];
}) {
  const [memberToDelete, setMemberToDelete] = useState<WorkspaceUser | null>(
    null,
  );
  const [invitationToCancel, setInvitationToCancel] =
    useState<WorkspaceUserInvitation | null>(null);
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { workspaceId } = Route.useParams();
  const { mutateAsync: deleteWorkspaceUser, isPending } =
    useDeleteWorkspaceUser();
  const { mutateAsync: cancelInvitation, isPending: isCancelling } =
    useCancelInvitation();

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    try {
      await deleteWorkspaceUser({
        workspaceId,
        userId: memberToDelete.user.email,
      });
      toast.success(t("team:membersTable.removeSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:membersTable.removeError"),
      );
    } finally {
      setMemberToDelete(null);
    }
  };

  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return;

    try {
      await cancelInvitation({
        invitationId: invitationToCancel.id,
        workspaceId,
      });
      toast.success(t("team:membersTable.cancelInviteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:membersTable.cancelInviteError"),
      );
    } finally {
      setInvitationToCancel(null);
    }
  };

  if (users?.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-xl bg-muted flex items-center justify-center">
            <span className="text-2xl">👥</span>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">
              {t("team:membersTable.emptyTitle")}
            </h3>
            <p className="text-muted-foreground">
              {t("team:membersTable.emptyDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-muted-foreground text-xs w-2/3 pl-6">
              {t("team:membersTable.columns.name")}
            </TableHead>
            <TableHead className="text-muted-foreground text-xs">
              {t("team:membersTable.columns.role")}
            </TableHead>
            <TableHead className="text-muted-foreground text-xs">
              {t("team:membersTable.columns.joined")}
            </TableHead>
            <TableHead className="text-muted-foreground text-xs pr-6 text-right">
              {t("team:membersTable.columns.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations
            .filter(
              (invitation) =>
                invitation.status !== "accepted" &&
                invitation.status !== "canceled",
            )
            ?.map((invitation) => (
              <TableRow key={invitation.email} className="cursor-pointer">
                <TableCell className="py-3 pl-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {invitation?.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{invitation.email}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                    {t("team:membersTable.memberRolePending", {
                      role:
                        invitation.role.charAt(0).toUpperCase() +
                        invitation.role.slice(1).toLowerCase(),
                    })}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <span className="text-sm text-muted-foreground">
                    {invitation.expiresAt &&
                      formatDateMedium(invitation.expiresAt)}
                  </span>
                </TableCell>
                <TableCell className="py-3 pr-6 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInvitationToCancel(invitation);
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label={t("team:membersTable.ariaCancelInvitation")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

          {users?.map((member) => (
            <TableRow key={member.user.email} className="cursor-pointer">
              <TableCell className="py-3 pl-6">
                <div className="flex items-center gap-3">
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src={member.user.image ?? ""}
                      alt={member.user.name || ""}
                    />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {member?.user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{member.user.name}</span>
                </div>
              </TableCell>
              <TableCell className="py-3">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                  {member.role.charAt(0).toUpperCase() +
                    member.role.slice(1).toLowerCase()}
                </span>
              </TableCell>

              <TableCell className="py-3">
                <span className="text-sm text-muted-foreground">
                  {member.createdAt && formatDateMedium(member.createdAt)}
                </span>
              </TableCell>
              <TableCell className="py-3 pr-6 text-right">
                {currentUser?.id !== member.userId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMemberToDelete(member);
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label={t("team:membersTable.ariaRemoveMember")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!memberToDelete}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("team:membersTable.removeDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("team:membersTable.removeDialogDescription", {
                name:
                  memberToDelete?.user.name || memberToDelete?.user.email || "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isPending}>
              <Button variant="outline" size="sm" disabled={isPending}>
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose onClick={handleDeleteMember} disabled={isPending}>
              <Button variant="destructive" size="sm" disabled={isPending}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t("team:membersTable.removeMember")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!invitationToCancel}
        onOpenChange={(open) => !open && setInvitationToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("team:membersTable.cancelDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("team:membersTable.cancelDialogDescription", {
                email: invitationToCancel?.email ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose disabled={isCancelling}>
              <Button variant="outline" size="sm" disabled={isCancelling}>
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose
              onClick={handleCancelInvitation}
              disabled={isCancelling}
            >
              <Button variant="destructive" size="sm" disabled={isCancelling}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t("team:membersTable.cancelInvitation")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default MembersTable;
