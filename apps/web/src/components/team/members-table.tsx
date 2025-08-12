import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import { getStatusIcon, getStatusText } from "@/lib/status";
import type WorkspaceUser from "@/types/workspace-user";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import DeleteTeamMemberModal from "./delete-team-member-modal";

function MembersTable({ users }: { users: WorkspaceUser[] }) {
  const { isOwner } = useWorkspacePermission();
  const [isRemoveMemberModalOpen, setIsRemoveMemberModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<WorkspaceUser | null>(
    null,
  );

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
            <TableHead className="text-foreground font-medium">
              Member
            </TableHead>
            <TableHead className="text-foreground font-medium">Role</TableHead>
            <TableHead className="text-foreground font-medium">
              Status
            </TableHead>
            <TableHead className="text-foreground font-medium">
              Joined
            </TableHead>
            {isOwner && (
              <TableHead className="text-foreground font-medium">
                Actions
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((member) => (
            <TableRow key={member.userId} className="cursor-pointer">
              <TableCell className="py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-muted text-muted-foreground font-medium text-xs">
                      {member.userId?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{member.userId}</span>
                </div>
              </TableCell>
              <TableCell className="py-3">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                  {member.role.charAt(0).toUpperCase() +
                    member.role.slice(1).toLowerCase()}
                </span>
              </TableCell>
              <TableCell className="py-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(member.status as "active" | "pending")}
                  <span className="text-sm text-muted-foreground">
                    {getStatusText(member.status as "active" | "pending")}
                  </span>
                </div>
              </TableCell>
              <TableCell className="py-3">
                <span className="text-sm text-muted-foreground">
                  {member.joinedAt &&
                    new Date(member.joinedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                </span>
              </TableCell>
              {isOwner && (
                <TableCell className="py-3">
                  {member.role === "owner" ? (
                    <span className="text-xs text-muted-foreground italic">
                      Workspace owner
                    </span>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1 hover:bg-accent rounded"
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setIsRemoveMemberModalOpen(true);
                            setSelectedMember(member);
                          }}
                          variant="destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedMember && (
        <DeleteTeamMemberModal
          userId={selectedMember.userId ?? ""}
          open={isRemoveMemberModalOpen}
          onClose={() => {
            setIsRemoveMemberModalOpen(false);
            setSelectedMember(null);
          }}
        />
      )}
    </>
  );
}

export default MembersTable;
