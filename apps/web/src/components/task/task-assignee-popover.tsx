import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShortcutNumber } from "@/components/ui/shortcut-number";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const INITIAL_VISIBLE_USERS = 40;
const VISIBLE_USERS_STEP = 40;

type TaskAssigneePopoverProps = {
  task: Task;
  workspaceId: string;
  children: React.ReactNode;
};

export default function TaskAssigneePopover({
  task,
  workspaceId,
  children,
}: TaskAssigneePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [visibleUsersCount, setVisibleUsersCount] = useState(
    INITIAL_VISIBLE_USERS,
  );
  const { mutateAsync: updateTaskAssignee } = useUpdateTaskAssignee();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { canAssignTasks } = useWorkspacePermission();
  const canAssign = canAssignTasks();

  const usersOptions = useMemo(() => {
    return workspaceUsers?.members?.map((member) => ({
      label: member?.user?.name ?? member.userId,
      value: member.userId,
      image: member?.user?.image ?? "",
      name: member?.user?.name ?? "",
    }));
  }, [workspaceUsers]);

  const currentAssigneeIds = useMemo(() => {
    if (task.assigneeIds && task.assigneeIds.length > 0)
      return task.assigneeIds;
    if (task.assignees && task.assignees.length > 0)
      return task.assignees.map((a) => a.id);
    if (task.userId) return [task.userId];
    return [];
  }, [task]);

  const [selectedIds, setSelectedIds] = useState<string[]>(currentAssigneeIds);

  useEffect(() => {
    setSelectedIds(currentAssigneeIds);
  }, [currentAssigneeIds]);

  const handleToggleAssignee = useCallback(
    async (userIdToToggle: string) => {
      let nextAssigneeIds: string[] = [];
      setSelectedIds((prevIds) => {
        if (!userIdToToggle) {
          nextAssigneeIds = [];
        } else if (prevIds.includes(userIdToToggle)) {
          nextAssigneeIds = prevIds.filter((id) => id !== userIdToToggle);
        } else {
          nextAssigneeIds = [...prevIds, userIdToToggle];
        }
        return nextAssigneeIds;
      });

      try {
        await updateTaskAssignee({
          ...task,
          userId: nextAssigneeIds[0] || null,
          assigneeIds: nextAssigneeIds,
        });
      } catch (error) {
        setSelectedIds(currentAssigneeIds);
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:popover.assignee.updateError"),
        );
      }
    },
    [t, task, currentAssigneeIds, updateTaskAssignee],
  );

  const shortcutOptions = useMemo(() => {
    const unassignedOption = { onSelect: () => handleToggleAssignee("") };
    const userOptions = (usersOptions || []).slice(0, 8).map((user) => ({
      onSelect: () => handleToggleAssignee(user.value),
    }));
    return [unassignedOption, ...userOptions];
  }, [usersOptions, handleToggleAssignee]);

  const visibleUsersOptions = useMemo(() => {
    return usersOptions?.slice(0, visibleUsersCount) ?? [];
  }, [usersOptions, visibleUsersCount]);

  const handleListScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const nearBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight < 48;

      if (!nearBottom) return;

      setVisibleUsersCount((current) => {
        const totalUsers = usersOptions?.length ?? current;
        return Math.min(current + VISIBLE_USERS_STEP, totalUsers);
      });
    },
    [usersOptions?.length],
  );

  if (!canAssign) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-56 p-1"
        align="start"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!open) return;
          const num = Number.parseInt(e.key, 10);
          if (!Number.isNaN(num) && num >= 1 && num <= 9) {
            e.preventDefault();
            const selectedOption = shortcutOptions[num - 1];
            if (selectedOption) {
              selectedOption.onSelect();
            }
          }
        }}
      >
        <div className="space-y-1" onScroll={handleListScroll}>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8 px-2"
            disabled={!canAssign}
            onClick={() => handleToggleAssignee("")}
          >
            <div
              className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center shrink-0"
              title={t("tasks:popover.assignee.unassigned")}
            >
              <span className="text-[10px] font-medium text-muted-foreground">
                ?
              </span>
            </div>
            <span className="text-sm">
              {t("tasks:popover.assignee.unassigned")}
            </span>
            {selectedIds.length === 0 ? (
              <Check className="ml-auto h-4 w-4" />
            ) : (
              <ShortcutNumber number={1} />
            )}
          </Button>
          {visibleUsersOptions.map((user, index) => {
            const isSelected = selectedIds.includes(user.value);
            return (
              <Button
                key={user.value}
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-8 px-2"
                disabled={!canAssign}
                onClick={() => handleToggleAssignee(user.value)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.image ?? ""} alt={user.name || ""} />
                  <AvatarFallback className="text-xs font-medium border border-border/30">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{user.label}</span>
                {isSelected ? (
                  <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
                ) : index < 8 ? (
                  <ShortcutNumber number={index + 2} />
                ) : null}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
