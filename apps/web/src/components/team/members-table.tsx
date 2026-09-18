import {
  CopyIcon,
  EllipsisIcon,
  MailIcon,
  PencilIcon,
  ShieldIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CurrentSalary } from "@/fetchers/pay";
import type { PersonStats } from "@/fetchers/people/get-people-overview";
import useCancelInvitation from "@/hooks/mutations/workspace-user/use-cancel-invitation";
import useDeleteWorkspaceUser from "@/hooks/mutations/workspace-user/use-delete-workspace-user";
import useUpdateWorkspaceUserRole from "@/hooks/mutations/workspace-user/use-update-workspace-user-role";
import { useCopyInvitationLink } from "@/hooks/use-copy-invitation-link";
import useGrantableRoles from "@/hooks/use-grantable-roles";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { formatHours } from "@/lib/format-duration";
import { getInitials } from "@/lib/get-initials";
import { formatMoney } from "@/lib/money";
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
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type PersonInfo = {
  title: string | null;
  departmentName: string | null;
  clockedIn: boolean;
  online: boolean;
  status?: string;
  joinDate?: string | null;
};

// Extra columns for people with people:read_all; salary only with payroll:read.
type AdminColumns = {
  stats: Map<string, PersonStats>;
  leaveAllowance: number;
  currency: string;
  salaries?: Map<string, CurrentSalary>;
  onEditSalary?: (userId: string, name: string) => void;
};

type Props = {
  workspaceId: string;
  invitations: WorkspaceUserInvitation[];
  users: WorkspaceUser[];
  // Company profile per user id; when given, rows show title/department and
  // presence, and names open the person's page where the viewer may see it.
  people?: Map<string, PersonInfo>;
  canOpenPerson?: (userId: string) => boolean;
  onOpenPerson?: (userId: string) => void;
  admin?: AdminColumns;
};

// Stable per-user pastel for the avatar fallback. Picks one of a curated set
// of Tailwind tone pairs from a cheap string hash so the same user keeps the
// same color across re-renders without server-side state.
const AVATAR_TONES = [
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
] as const;

function toneFor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function MembersTable({
  workspaceId,
  invitations,
  users,
  people,
  canOpenPerson,
  onOpenPerson,
  admin,
}: Props) {
  const { t, i18n } = useTranslation();
  const showSalary = Boolean(admin?.salaries);
  // Admin cells sit between Name and Role; invitation rows span them.
  const extraColumns = admin ? 4 + (showSalary ? 1 : 0) : 0;
  const [memberToDelete, setMemberToDelete] = useState<WorkspaceUser | null>(
    null,
  );
  const [invitationToCancel, setInvitationToCancel] =
    useState<WorkspaceUserInvitation | null>(null);

  const { user: currentUser } = useAuth();
  const { mutateAsync: deleteWorkspaceUser, isPending: isDeleting } =
    useDeleteWorkspaceUser();
  const { mutateAsync: cancelInvitation, isPending: isCancelling } =
    useCancelInvitation();
  const { mutateAsync: updateMemberRole } = useUpdateWorkspaceUserRole();
  const { copy: copyInvitationLink } = useCopyInvitationLink();
  const { roles: grantableRoles } = useGrantableRoles(workspaceId);
  const { canManageTeam, canRemoveMembers, canInviteUsers } =
    useWorkspacePermission();
  const canChangeRoles = Boolean(canManageTeam());
  const canRemove = Boolean(canRemoveMembers());
  const canInvite = Boolean(canInviteUsers());

  // Owner first, then everyone else (stable on ties so the original
  // listMembers order is preserved within each group).
  const sortedUsers = [...users].sort((a, b) => {
    if (a.role === b.role) return 0;
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    return 0;
  });

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-6 text-foreground font-medium">
              {t("team:membersTable.columns.name", {
                defaultValue: "Member",
              })}
            </TableHead>
            {admin && (
              <>
                <TableHead className="text-foreground font-medium">
                  {t("people:table.status")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("people:table.tasks")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("people:table.thisMonth")}
                </TableHead>
                <TableHead className="text-foreground font-medium">
                  {t("people:table.leave")}
                </TableHead>
                {showSalary && (
                  <TableHead className="text-end text-foreground font-medium">
                    {t("people:table.salary")}
                  </TableHead>
                )}
              </>
            )}
            <TableHead className="text-foreground font-medium">
              {t("team:membersTable.columns.role", { defaultValue: "Role" })}
            </TableHead>
            <TableHead className="text-foreground font-medium">
              {t("team:membersTable.columns.joined", {
                defaultValue: "Joined",
              })}
            </TableHead>
            <TableHead className="w-px pe-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedUsers.map((member) => {
            const isSelf = currentUser?.id === member.userId;
            // Only members whose current role the viewer could have granted
            // are editable; the API enforces the same rule.
            const showRoleSelect =
              canChangeRoles &&
              !isSelf &&
              member.role !== "owner" &&
              grantableRoles.includes(member.role);
            const tone = toneFor(member.user.email);
            const person = people?.get(member.userId);
            const canOpen = Boolean(
              onOpenPerson && canOpenPerson?.(member.userId),
            );
            const stats = admin?.stats.get(member.userId);
            const salary = admin?.salaries?.get(member.userId);
            return (
              <TableRow key={member.user.email}>
                <TableCell className="ps-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <Avatar className={cn("size-8", tone)}>
                        <AvatarImage
                          src={member.user.image ?? ""}
                          alt={member.user.name ?? ""}
                        />
                        <AvatarFallback className="bg-transparent text-[11px] font-medium">
                          {getInitials(member.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      {person && (person.clockedIn || person.online) ? (
                        <span
                          className={cn(
                            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background",
                            person.clockedIn
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/60",
                          )}
                          title={
                            person.clockedIn
                              ? t("people:status.clockedIn")
                              : t("people:status.online")
                          }
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {canOpen ? (
                          <button
                            type="button"
                            onClick={() => onOpenPerson?.(member.userId)}
                            className="text-sm font-medium hover:underline"
                          >
                            {member.user.name}
                          </button>
                        ) : (
                          <span className="text-sm font-medium">
                            {member.user.name}
                          </span>
                        )}
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">
                            ({t("team:members.you", { defaultValue: "You" })})
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {person?.title || person?.departmentName
                          ? [person.title, person.departmentName]
                              .filter(Boolean)
                              .join(" · ")
                          : member.user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                {admin && (
                  <>
                    <TableCell className="py-3">
                      <StatusBadge
                        status={person?.status}
                        onLeaveToday={stats?.onLeaveToday ?? false}
                        clockedIn={person?.clockedIn ?? false}
                        online={person?.online ?? false}
                      />
                    </TableCell>
                    <TableCell className="py-3 text-sm tabular-nums">
                      {stats?.openTasks ? (
                        <span>
                          {stats.openTasks}
                          {stats.overdueTasks > 0 && (
                            <span className="ms-1.5 rounded bg-destructive/15 px-1 text-xs text-destructive">
                              {t("people:table.overdue", {
                                count: stats.overdueTasks,
                              })}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-sm tabular-nums text-muted-foreground">
                      {stats?.workedMinutesThisMonth
                        ? formatHours(stats.workedMinutesThisMonth * 60)
                        : "–"}
                    </TableCell>
                    <TableCell className="py-3">
                      <LeaveMeter
                        used={stats?.leaveUsed ?? 0}
                        pending={stats?.leavePending ?? 0}
                        allowance={admin.leaveAllowance}
                      />
                    </TableCell>
                    {showSalary && (
                      <TableCell className="py-3 text-end">
                        <div className="group/salary inline-flex items-center justify-end gap-1">
                          {salary?.amount != null ? (
                            <span className="text-sm font-medium tabular-nums">
                              {formatMoney(
                                salary.amount,
                                admin.currency,
                                i18n.language,
                              )}
                              <span className="ms-1 text-xs font-normal text-muted-foreground">
                                {salary.type === "hourly"
                                  ? t("people:table.perHour")
                                  : t("people:table.perMonth")}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t("people:table.noSalary")}
                            </span>
                          )}
                          {admin.onEditSalary && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t("people:table.editSalary", {
                                name: member.user.name,
                              })}
                              title={t("people:table.editSalary", {
                                name: member.user.name,
                              })}
                              onClick={() =>
                                admin.onEditSalary?.(
                                  member.userId,
                                  member.user.name ?? member.user.email,
                                )
                              }
                              className="text-muted-foreground opacity-60 hover:opacity-100 group-hover/salary:opacity-100"
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </>
                )}
                <TableCell className="py-3">
                  {member.role === "owner" ? (
                    <Badge variant="outline" className="gap-1">
                      <ShieldIcon className="size-3" />
                      {t("team:roles.owner", { defaultValue: "Owner" })}
                    </Badge>
                  ) : showRoleSelect ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) => {
                        if (typeof value === "string" && value) {
                          handleChangeRole(member, value);
                        }
                      }}
                    >
                      <SelectTrigger size="sm" className="h-8 w-32">
                        <SelectValue>
                          {t(`team:roles.${member.role}`, {
                            defaultValue: capitalize(member.role),
                          })}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {/* Owner is never offered here: the better-auth
                            organization plugin requires an explicit ownership
                            transfer flow (a workspace must have exactly one owner). */}
                        {grantableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {t(`team:roles.${role}`, {
                              defaultValue: capitalize(role),
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary" className="capitalize">
                      {t(`team:roles.${member.role}`, {
                        defaultValue: capitalize(member.role),
                      })}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                  {person?.joinDate
                    ? formatDateMedium(person.joinDate)
                    : member.createdAt
                      ? formatDateMedium(member.createdAt)
                      : "–"}
                </TableCell>
                <TableCell className="pe-6 py-3 text-right">
                  {!isSelf && canRemove ? (
                    <Menu>
                      <MenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            aria-label={t("team:membersTable.ariaRemoveMember")}
                          />
                        }
                      >
                        <EllipsisIcon className="size-4" />
                      </MenuTrigger>
                      <MenuPopup align="end">
                        <MenuItem onClick={() => setMemberToDelete(member)}>
                          <TrashIcon className="size-4" />
                          {t("team:membersTable.removeMember")}
                        </MenuItem>
                      </MenuPopup>
                    </Menu>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}

          {pendingInvitations.map((invitation) => (
            <TableRow key={`invite-${invitation.id}`}>
              <TableCell className="ps-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <MailIcon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {invitation.email}
                      </span>
                      <Badge
                        variant="outline"
                        size="sm"
                        className="font-mono text-[9px] uppercase tracking-wider"
                      >
                        {t("team:invitations.pendingBadge", {
                          defaultValue: "pending",
                        })}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {invitation.expiresAt
                        ? t("team:invitations.expires", {
                            defaultValue: "Expires {{date}}",
                            date: formatDateMedium(invitation.expiresAt),
                          })
                        : "–"}
                    </div>
                  </div>
                </div>
              </TableCell>
              {extraColumns > 0 && <TableCell colSpan={extraColumns} />}
              <TableCell className="py-3">
                <Badge variant="outline" className="capitalize">
                  {t(`team:roles.${invitation.role}`, {
                    defaultValue: capitalize(invitation.role),
                  })}
                </Badge>
              </TableCell>
              <TableCell className="py-3 text-sm text-muted-foreground">
                –
              </TableCell>
              <TableCell className="pe-6 py-3 text-right">
                {canInvite ? (
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          aria-label={t(
                            "team:membersTable.ariaInvitationActions",
                          )}
                        />
                      }
                    >
                      <EllipsisIcon className="size-4" />
                    </MenuTrigger>
                    <MenuPopup align="end">
                      <MenuItem
                        onClick={() => copyInvitationLink(invitation.id)}
                      >
                        <CopyIcon className="size-4" />
                        {t("team:invitations.copyLink")}
                      </MenuItem>
                      <MenuItem
                        onClick={() => setInvitationToCancel(invitation)}
                      >
                        <TrashIcon className="size-4" />
                        {t("team:membersTable.cancelInvitation")}
                      </MenuItem>
                    </MenuPopup>
                  </Menu>
                ) : null}
              </TableCell>
            </TableRow>
          ))}

          {users.length === 0 && pendingInvitations.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4 + extraColumns}
                className="py-16 text-center"
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <p className="text-sm font-medium text-foreground">
                    {t("team:membersTable.emptyTitle")}
                  </p>
                  <p className="text-xs">
                    {t("team:membersTable.emptyDescription")}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : null}
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
            <AlertDialogClose
              render={
                <Button variant="outline" size="sm" disabled={isDeleting} />
              }
            >
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  onClick={handleDeleteMember}
                />
              }
            >
              <TrashIcon className="mr-2 size-4" />
              {t("team:membersTable.removeMember")}
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
            <AlertDialogClose
              render={
                <Button variant="outline" size="sm" disabled={isCancelling} />
              }
            >
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isCancelling}
                  onClick={handleCancelInvitation}
                />
              }
            >
              <TrashIcon className="mr-2 size-4" />
              {t("team:membersTable.cancelInvitation")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatusBadge({
  status,
  onLeaveToday,
  clockedIn,
  online,
}: {
  status?: string;
  onLeaveToday: boolean;
  clockedIn: boolean;
  online: boolean;
}) {
  const { t } = useTranslation();
  const [label, dot, text] =
    status === "inactive"
      ? [
          t("people:status.inactive"),
          "bg-muted-foreground/40",
          "text-muted-foreground",
        ]
      : onLeaveToday || status === "on_leave"
        ? [t("people:status.on_leave"), "bg-amber-500", "text-foreground"]
        : clockedIn
          ? [t("people:table.present"), "bg-emerald-500", "text-foreground"]
          : online
            ? [t("people:status.online"), "bg-sky-500", "text-foreground"]
            : [
                t("people:table.away"),
                "bg-muted-foreground/40",
                "text-muted-foreground",
              ];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", text)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

function LeaveMeter({
  used,
  pending,
  allowance,
}: {
  used: number;
  pending: number;
  allowance: number;
}) {
  const { t } = useTranslation();
  const pct = (n: number) =>
    allowance > 0 ? Math.min((n / allowance) * 100, 100) : 0;
  return (
    <div
      className="w-24 space-y-1"
      title={t("people:table.leaveHint", { used, pending, allowance })}
    >
      <div className="text-xs tabular-nums">
        {used}/{allowance}
        {pending > 0 && (
          <span className="ms-1 text-muted-foreground">
            {t("people:table.leavePending", { count: pending })}
          </span>
        )}
      </div>
      <div className="flex h-1 overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct(used)}%` }} />
        <div
          className="h-full bg-primary/40"
          style={{ width: `${pct(pending)}%` }}
        />
      </div>
    </div>
  );
}

export default MembersTable;
