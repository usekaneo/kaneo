import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useCancelInvitation from "@/hooks/mutations/workspace-user/use-cancel-invitation";
import useDeleteWorkspaceUser from "@/hooks/mutations/workspace-user/use-delete-workspace-user";
import { Route } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/members";
import type {
  WorkspaceUser,
  WorkspaceUserInvitation,
} from "@/types/workspace-user";
import { useAuth } from "../providers/auth-provider/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
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
      toast.success("Team member removed successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove team member",
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
      toast.success("Invitation cancelled successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel invitation",
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
            <h3 className="text-xl font-semibold">No team members yet</h3>
            <p className="text-muted-foreground">
              Invite your first team member to get started.
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
              Name
            </TableHead>
            <TableHead className="text-muted-foreground text-xs">
              Role
            </TableHead>
            <TableHead className="text-muted-foreground text-xs">
              Joined
            </TableHead>
            <TableHead className="text-muted-foreground text-xs pr-6 text-right">
              Actions
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
                    {invitation.role.charAt(0).toUpperCase() +
                      invitation.role.slice(1).toLowerCase()}{" "}
                    (Pending)
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <span className="text-sm text-muted-foreground">
                    {invitation.expiresAt &&
                      new Date(invitation.expiresAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
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
                    aria-label="Cancel invitation"
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
                  {member.createdAt &&
                    new Date(member.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
                    aria-label="Remove member"
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
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {memberToDelete?.user.name || memberToDelete?.user.email}
              </span>{" "}
              from the workspace? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!invitationToCancel}
        onOpenChange={(open) => !open && setInvitationToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation for{" "}
              <span className="font-medium text-foreground">
                {invitationToCancel?.email}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvitation}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default MembersTable;
