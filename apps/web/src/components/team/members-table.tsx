import { Mail, MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import useCancelInvitation from "@/hooks/mutations/workspace-user/use-cancel-invitation";
import useDeleteWorkspaceUser from "@/hooks/mutations/workspace-user/use-delete-workspace-user";
import useUpdateWorkspaceUserRole from "@/hooks/mutations/workspace-user/use-update-workspace-user-role";
import useWorkspaceRoles from "@/hooks/queries/workspace/use-workspace-roles";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
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
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type Props = {
  workspaceId: string;
  invitations: WorkspaceUserInvitation[];
  users: WorkspaceUser[];
  onInvite: () => void;
};

function initials(value: string | null | undefined): string {
  if (!value) return "?";
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function MembersTable({ workspaceId, invitations, users, onInvite }: Props) {
  const [memberToDelete, setMemberToDelete] = useState<WorkspaceUser | null>(
    null,
  );
  const [invitationToCancel, setInvitationToCancel] =
    useState<WorkspaceUserInvitation | null>(null);
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { mutateAsync: deleteWorkspaceUser, isPending } =
    useDeleteWorkspaceUser();
  const { mutateAsync: cancelInvitation, isPending: isCancelling } =
    useCancelInvitation();
  const { mutateAsync: updateMemberRole } = useUpdateWorkspaceUserRole();
  const { data: customRoles = [] } = useWorkspaceRoles(workspaceId);
  const { isOwner, canManageTeam, canRemoveMembers, canInviteUsers } =
    useWorkspacePermission();
  const canChangeRoles = Boolean(canManageTeam());
  const canRemove = Boolean(canRemoveMembers());
  const canInvite = Boolean(canInviteUsers());

  const pendingInvitations = invitations.filter(
    (inv) => inv.status !== "accepted" && inv.status !== "canceled",
  );

  const handleChangeRole = async (member: WorkspaceUser, role: string) => {
    if (role === member.role) return;
    try {
      await updateMemberRole({ workspaceId, memberId: member.id, role });
      toast.success(t("team:membersTable.roleUpdateSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:membersTable.roleUpdateError"),
      );
    }
  };

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

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("team:members.sectionTitle", { defaultValue: "Members" })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {users.length === 0
                ? t("team:members.emptyDescription", {
                    defaultValue: "No members yet.",
                  })
                : t("team:members.countDescription", {
                    defaultValue:
                      "{{count}} {{label}} with access to this workspace.",
                    count: users.length,
                    label: users.length === 1 ? "person" : "people",
                  })}
            </p>
          </div>
          {canInvite && (
            <Button size="sm" onClick={onInvite} className="gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              {t("team:members.inviteMember")}
            </Button>
          )}
        </div>

        <div className="border border-border rounded-md bg-sidebar overflow-hidden">
          {users.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UserPlus />
                </EmptyMedia>
                <EmptyTitle>{t("team:membersTable.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("team:membersTable.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {users.map((member) => {
                const isSelf = currentUser?.id === member.userId;
                const showRoleSelect = canChangeRoles && !isSelf;
                return (
                  <li
                    key={member.user.email}
                    className="flex items-center gap-4 px-4 py-3"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={member.user.image ?? ""}
                        alt={member.user.name || ""}
                      />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {initials(member.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.user.name}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            ({t("team:members.you", { defaultValue: "You" })})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.user.email}
                      </p>
                    </div>
                    {showRoleSelect ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => {
                          if (typeof value === "string" && value) {
                            handleChangeRole(member, value);
                          }
                        }}
                      >
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue className="capitalize">
                            {member.role}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {isOwner && (
                            <SelectItem value="owner">Owner</SelectItem>
                          )}
                          {customRoles.map((r) => (
                            <SelectItem key={r.id} value={r.role}>
                              {r.role.charAt(0).toUpperCase() + r.role.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="capitalize">
                        {member.role}
                      </Badge>
                    )}
                    {!isSelf && canRemove && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              aria-label={t(
                                "team:membersTable.ariaRemoveMember",
                              )}
                            />
                          }
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setMemberToDelete(member)}
                          >
                            <Trash2 className="w-4 h-4" />
                            {t("team:membersTable.removeMember")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {pendingInvitations.length > 0 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("team:invitations.sectionTitle", {
                defaultValue: "Pending invitations",
              })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("team:invitations.countDescription", {
                defaultValue: "{{count}} {{label}} awaiting acceptance.",
                count: pendingInvitations.length,
                label:
                  pendingInvitations.length === 1
                    ? "invitation"
                    : "invitations",
              })}
            </p>
          </div>
          <div className="border border-border rounded-md bg-sidebar overflow-hidden">
            <ul className="divide-y divide-border">
              {pendingInvitations.map((invitation) => (
                <li
                  key={invitation.email}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {invitation.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("team:invitations.expires", {
                        defaultValue: "Expires {{date}}",
                        date: invitation.expiresAt
                          ? formatDateMedium(invitation.expiresAt)
                          : "—",
                      })}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {invitation.role}
                  </Badge>
                  {canInvite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setInvitationToCancel(invitation)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={t("team:membersTable.ariaCancelInvitation")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
