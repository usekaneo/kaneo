import type {
  WorkspaceUser,
  WorkspaceUserInvitation,
} from "@/types/workspace-user";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-muted-foreground text-xs w-2/3 pl-6">
            Name
          </TableHead>
          <TableHead className="text-muted-foreground text-xs">Role</TableHead>
          <TableHead className="text-muted-foreground text-xs pr-10">
            Joined
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations
          .filter((invitation) => invitation.status !== "accepted")
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
                    new Date(invitation.expiresAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                </span>
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

            <TableCell className="py-3 pr-6">
              <span className="text-sm text-muted-foreground">
                {member.createdAt &&
                  new Date(member.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default MembersTable;
