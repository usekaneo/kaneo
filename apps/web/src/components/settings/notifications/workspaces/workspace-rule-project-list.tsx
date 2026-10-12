import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import useGetProjects from "@/hooks/queries/project/use-get-projects";

type WorkspaceRuleProjectListProps = {
  workspaceId: string;
  selectedProjectIds: string[];
  disabled: boolean;
  onToggle: (projectId: string, checked: boolean) => void;
};

export function WorkspaceRuleProjectList({
  workspaceId,
  selectedProjectIds,
  disabled,
  onToggle,
}: WorkspaceRuleProjectListProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const { data: projects, isLoading } = useGetProjects({ workspaceId });

  if (isLoading || !projects?.length) {
    return (
      <p className="rounded-lg border border-border px-3 py-2.5 text-sm text-muted-foreground">
        {isLoading
          ? t("common:empty.loading")
          : t("settings:notificationsPage.noProjectsInWorkspace")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border p-1">
      {projects.map((project) => {
        const id = `${baseId}-${project.id}`;

        return (
          <label
            key={project.id}
            className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-sm hover:bg-accent/50"
            htmlFor={id}
          >
            <Checkbox
              checked={selectedProjectIds.includes(project.id)}
              disabled={disabled}
              id={id}
              onCheckedChange={(checked) => onToggle(project.id, checked)}
            />
            <span className="min-w-0 truncate">{project.name}</span>
          </label>
        );
      })}
    </div>
  );
}
