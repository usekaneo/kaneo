import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import icons from "@/constants/project-icons";
import getColumns from "@/fetchers/column/get-columns";
import { useMoveTask } from "@/hooks/mutations/task/use-move-task";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import queryClient from "@/query-client";
import type Task from "@/types/task";
import { statusMenuOptions } from "./menus/status-menu-options";

type TaskMovePopoverProps = {
  task: Task;
  workspaceId: string;
  children: ReactNode;
};

export default function TaskMovePopover({
  task,
  workspaceId,
  children,
}: TaskMovePopoverProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const {
    data: columns = [],
    isLoading,
    isError,
  } = useGetColumns(projectId ?? "");
  const { mutateAsync: moveTask } = useMoveTask();

  const destinations = projects.filter(
    (project) => project.id !== task.projectId,
  );

  if (destinations.length === 0) return <>{children}</>;

  const moveTo = async (destinationProjectId: string, status: string) => {
    setOpen(false);
    const result = await moveTask({
      taskId: task.id,
      destinationProjectId,
      destinationStatus: status,
    }).catch(() => null);
    if (!result) return;
    startTransition(() => {
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
        params: {
          workspaceId,
          projectId: result.task.projectId,
          taskId: task.id,
        },
      });
    });
  };

  const pickProject = async (id: string) => {
    const destinationColumns = await queryClient
      .fetchQuery({
        queryKey: ["columns", id],
        queryFn: () => getColumns(id),
        staleTime: 0,
      })
      .catch(() => null);
    if (destinationColumns?.some((column) => column.slug === task.status)) {
      void moveTo(id, task.status);
      return;
    }
    setProjectId(id);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setProjectId(null);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        {projectId === null ? (
          <OptionMenu
            key="projects"
            label={t("tasks:move.title")}
            placeholder={t("tasks:move.projectPlaceholder")}
            options={destinations.map((project) => {
              const ProjectIcon =
                icons[project.icon as keyof typeof icons] || icons.Layout;
              return {
                value: project.id,
                label: project.name,
                icon: <ProjectIcon className="text-muted-foreground" />,
              };
            })}
            onSelect={(id) => void pickProject(id)}
          />
        ) : (
          <OptionMenu
            key="statuses"
            label={t("tasks:move.statusLabel")}
            placeholder={t("tasks:move.statusLabel")}
            options={statusMenuOptions(columns, null)}
            onSelect={(status) => void moveTo(projectId, status)}
            status={
              isLoading ? (
                t("common:empty.loading")
              ) : isError ? (
                <span className="text-destructive-foreground">
                  {t("tasks:move.error")}
                </span>
              ) : undefined
            }
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
