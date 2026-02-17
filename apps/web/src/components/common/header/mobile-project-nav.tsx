import { Check, Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import icons from "@/constants/project-icons";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { cn } from "@/lib/cn";

type MobileProjectNavProps = {
  workspaceId: string;
  projectId: string;
  activeView: "backlog" | "board";
  onSelectBoard: () => void;
  onSelectBacklog: () => void;
  onSelectProject: (projectId: string) => void;
  onAddProject: () => void;
};

export default function MobileProjectNav({
  workspaceId,
  projectId,
  activeView,
  onSelectBoard,
  onSelectBacklog,
  onSelectProject,
  onAddProject,
}: MobileProjectNavProps) {
  const { data: projects = [] } = useGetProjects({ workspaceId });

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-7 border border-transparent"
          />
        }
      >
        <Menu className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              View
            </p>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={onSelectBacklog}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  activeView === "backlog"
                    ? "border-border bg-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent",
                )}
              >
                Backlog
              </button>
              <button
                type="button"
                onClick={onSelectBoard}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                  activeView === "board"
                    ? "border-border bg-secondary text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent",
                )}
              >
                Board
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Projects
            </p>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {(projects ?? []).map((project) => {
                const Icon =
                  icons[project.icon as keyof typeof icons] || icons.Layout;
                const isCurrentProject = project.id === projectId;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      isCurrentProject
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span className="flex-1 truncate">{project.name}</span>
                    {isCurrentProject && <Check className="size-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onAddProject}
            className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-3.5" />
            Add project
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
