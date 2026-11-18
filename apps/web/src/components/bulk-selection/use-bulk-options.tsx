import { Inbox, Rocket } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SPRINT_FILTER_VALUES } from "@/hooks/use-task-filters";
import { getColumnIcon } from "@/lib/column";
import { getInitials } from "@/lib/get-initials";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { resolveLabelColor } from "@/lib/label-color";
import { getPriorityIcon } from "@/lib/priority";
import type { OptionMenuItem } from "@/components/common/option-menu/option-menu-item";
import type { BulkActions } from "./use-bulk-actions";

const PRIORITIES = ["urgent", "high", "medium", "low", "no-priority"];

export function useBulkOptions(actions: BulkActions) {
  const { t } = useTranslation();
  const { columns, members, labels, sprints } = actions;

  return useMemo(() => {
    const columnOptions: OptionMenuItem[] = columns.map((column) => ({
      value: column.id,
      label: column.name,
      icon: getColumnIcon(column.id, column.isFinal, column.icon),
    }));
    const priorityOptions: OptionMenuItem[] = PRIORITIES.map((priority) => ({
      value: priority,
      label: getPriorityLabel(priority),
      icon: getPriorityIcon(priority),
    }));
    const memberOptions: OptionMenuItem[] = members.map((member) => ({
      value: member.id,
      label: member.name || t("common:people.someone"),
      icon: (
        <Avatar className="size-4">
          <AvatarImage src={member.image ?? ""} alt="" />
          <AvatarFallback className="text-[8px]">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
      ),
    }));
    const labelOptions: OptionMenuItem[] = labels.map((label) => ({
      value: label.id,
      label: label.name,
      icon: (
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: resolveLabelColor(label.color) }}
        />
      ),
    }));
    const sprintOptions: OptionMenuItem[] = [
      {
        value: SPRINT_FILTER_VALUES.backlog,
        label: t("tasks:sprints.backlog"),
        icon: <Inbox className="size-4 text-muted-foreground" />,
      },
      ...sprints
        .filter((sprint) => sprint.status !== "closed")
        .map((sprint) => ({
          value: sprint.id,
          label: sprint.name,
          icon: <Rocket className="size-4 text-muted-foreground" />,
        })),
    ];
    return {
      columnOptions,
      priorityOptions,
      memberOptions,
      labelOptions,
      sprintOptions,
    };
  }, [columns, members, labels, sprints, t]);
}
