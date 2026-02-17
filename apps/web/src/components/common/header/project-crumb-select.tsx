import { ChevronsUpDown, Plus } from "lucide-react";
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
import icons from "@/constants/project-icons";
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
  const { data: projects = [] } = useGetProjects({ workspaceId });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="h-7 justify-between px-2 text-xs text-foreground"
          />
        }
      >
        <span className="truncate text-left">
          {projectName || "Select project"}
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
            Projects
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {(projects ?? []).length > 0 ? (
            (projects ?? []).map((project) => {
              const Icon =
                icons[project.icon as keyof typeof icons] || icons.Layout;
              return (
                <DropdownMenuItem
                  key={project.id}
                  disabled={project.id === projectId}
                  onClick={() => onSelectProject(project.id)}
                  className="h-8 gap-2 text-sm"
                >
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span className="truncate">{project.name}</span>
                </DropdownMenuItem>
              );
            })
          ) : (
            <DropdownMenuItem
              disabled
              className="h-8 text-sm text-muted-foreground"
            >
              No projects
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
            Add project
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
