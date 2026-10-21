import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AssigneeOptionsMenu } from "@/components/task/menus/assignee-options-menu";
import { AssigneeAvatar } from "@/components/task/properties/assignee-avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { WorkspaceTaskQuery } from "@/fetchers/task/get-workspace-tasks";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";

type Props = {
  workspaceId: string;
  filters: WorkspaceTaskQuery;
  onChange: (filters: WorkspaceTaskQuery) => void;
};
export function WorkspaceTaskFilters({
  workspaceId,
  filters,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const projects = useGetProjects({ workspaceId });
  const members = useGetActiveWorkspaceUsers(workspaceId);
  const [open, setOpen] = useState(false);
  const people = members.data?.members.map((member) => member.user) ?? [];
  const selectPerson = (id: string) =>
    onChange({
      ...filters,
      assigneeId: filters.assigneeId === id ? undefined : id,
    });
  const choices = [
    {
      key: "projectId" as const,
      label: t("workspace:taskViews.project"),
      items: [
        { value: "all", label: t("workspace:taskViews.allProjects") },
        ...(projects.data ?? []).map((project) => ({
          value: project.id,
          label: project.name,
        })),
      ],
    },
    {
      key: "priority" as const,
      label: t("tasks:priority.label"),
      items: [
        { value: "all", label: t("workspace:taskViews.allPriorities") },
        ...["no-priority", "low", "medium", "high", "urgent"].map((value) => ({
          value,
          label: t(`tasks:priority.${value}`),
        })),
      ],
    },
    {
      key: "completion" as const,
      label: t("workspace:taskViews.completion"),
      items: [
        { value: "all", label: t("workspace:taskViews.allStates") },
        { value: "open", label: t("workspace:taskViews.open") },
        { value: "completed", label: t("workspace:taskViews.completed") },
      ],
    },
  ];
  return (
    <>
      {choices.map((choice) => (
        <Select
          key={choice.key}
          items={choice.items}
          value={filters[choice.key] ?? "all"}
          onValueChange={(value) =>
            onChange({
              ...filters,
              [choice.key]:
                value === "all" && choice.key !== "completion"
                  ? undefined
                  : value,
            })
          }
        >
          <SelectTrigger
            size="sm"
            className="w-auto max-w-48"
            aria-label={choice.label}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {choice.items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant={filters.assigneeId ? "secondary" : "outline"}
              size="sm"
            />
          }
        >
          {people.find((person) => person.id === filters.assigneeId)?.name ??
            (filters.assigneeId === "unassigned"
              ? t("tasks:popover.assignee.unassigned")
              : t("tasks:assignee.label"))}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0">
          <PopoverTitle className="sr-only">
            {t("tasks:assignee.label")}
          </PopoverTitle>
          <AssigneeOptionsMenu
            members={people}
            current={
              filters.assigneeId === "unassigned"
                ? []
                : filters.assigneeId
                  ? [filters.assigneeId]
                  : undefined
            }
            onSelect={(id) => {
              selectPerson(id || "unassigned");
              setOpen(false);
            }}
            status={
              members.isError ? (
                <Button variant="link" onClick={() => void members.refetch()}>
                  {t("common:error.tryAgain")}
                </Button>
              ) : members.isPending ? (
                t("common:empty.loading")
              ) : undefined
            }
          />
          {filters.assigneeId && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                onChange({ ...filters, assigneeId: undefined });
                setOpen(false);
              }}
            >
              {t("workspace:taskViews.allAssignees")}
            </Button>
          )}
        </PopoverContent>
      </Popover>
      <div
        className="hidden items-center gap-1 md:flex"
        role="group"
        aria-label={t("tasks:assignee.label")}
      >
        {people.slice(0, 6).map((person) => (
          <Button
            key={person.id}
            variant={filters.assigneeId === person.id ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("workspace:taskViews.filterPerson", {
              name: person.name,
            })}
            aria-pressed={filters.assigneeId === person.id}
            onClick={() => selectPerson(person.id)}
          >
            <AssigneeAvatar
              assigned
              name={person.name}
              image={person.image}
              className="size-5"
            />
          </Button>
        ))}
      </div>
      {(filters.projectId ||
        filters.priority ||
        filters.assigneeId ||
        filters.completion !== "all") && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({ search: filters.search, completion: "all" })
          }
        >
          {t("common:actions.clearAll")}
        </Button>
      )}
      {(projects.isError || members.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {t("workspace:taskViews.optionsError")}
        </p>
      )}
    </>
  );
}
