import { ChevronsUpDown, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import useGetProjects from "@/hooks/queries/project/use-get-projects";

type ProjectCrumbSelectProps = {
  workspaceId: string;
  projectId: string;
  projectName?: string;
  onSelectProject: (projectId: string) => void;
  onAddProject: () => void;
};

export default function ProjectCrumbSelect({
  workspaceId,
  projectId,
  projectName,
  onSelectProject,
  onAddProject,
}: ProjectCrumbSelectProps) {
  const { t } = useTranslation();
  const { data: projects = [] } = useGetProjects({ workspaceId });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="h-7 justify-between gap-2.5 px-2 text-xs text-foreground"
          />
        }
      >
        <span className="truncate text-left">
          {projectName || t("settings:projectSwitcher.selectProject")}
        </span>
        <ChevronsUpDown className="size-3 text-foreground/70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
            {t("navigation:sidebar.projects")}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {(projects ?? []).length > 0 ? (
            (projects ?? []).map((project) => {
              return (
                <DropdownMenuItem
                  key={project.id}
                  disabled={project.id === projectId}
                  onClick={() => onSelectProject(project.id)}
                  className="h-8 gap-2 text-sm"
                >
                  <span className="truncate">{project.name}</span>
                </DropdownMenuItem>
              );
            })
          ) : (
            <DropdownMenuItem
              disabled
              className="h-8 text-sm text-muted-foreground"
            >
              {t("settings:projectSwitcher.noProjects")}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={onAddProject}
            className="h-8 gap-2 text-sm"
          >
            <Plus className="size-3.5" />
            {t("navigation:projectList.addProject")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
