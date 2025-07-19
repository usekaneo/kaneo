import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  FolderOpen,
  Settings,
  User,
} from "lucide-react";

interface SettingsMenuProps {
  variant?: "nav" | "user-dropdown";
  className?: string;
}

export function SettingsMenu({
  variant = "nav",
  className,
}: SettingsMenuProps) {
  const { workspace } = useWorkspaceStore();
  const { project } = useProjectStore();
  const navigate = useNavigate();

  const handleUserSettings = () => {
    navigate({ to: "/dashboard/settings/appearance" });
  };

  const handleWorkspaceSettings = () => {
    if (!workspace) return;
    navigate({
      to: "/dashboard/workspace/$workspaceId/settings",
      params: { workspaceId: workspace.id },
    });
  };

  const handleProjectSettings = () => {
    if (!workspace || !project) return;
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/settings",
      params: {
        workspaceId: workspace.id,
        projectId: project.id,
      },
    });
  };

  if (variant === "user-dropdown") {
    return (
      <DropdownMenuItem onClick={handleUserSettings} className="cursor-pointer">
        <Settings className="w-4 h-4 mr-2" />
        Settings
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full flex items-center gap-2 justify-between",
            className,
          )}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </div>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings className="w-3 h-3" />
          Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleUserSettings}
          className="cursor-pointer"
        >
          <User className="w-4 h-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">User Settings</span>
            <span className="text-xs text-muted-foreground">
              Appearance, preferences
            </span>
          </div>
        </DropdownMenuItem>

        {workspace && (
          <DropdownMenuItem
            onClick={handleWorkspaceSettings}
            className="cursor-pointer"
          >
            <Building2 className="w-4 h-4 mr-2" />
            <div className="flex flex-col">
              <span className="font-medium">Workspace Settings</span>
              <span className="text-xs text-muted-foreground">
                {workspace.name}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {workspace && project && (
          <DropdownMenuItem
            onClick={handleProjectSettings}
            className="cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            <div className="flex flex-col">
              <span className="font-medium">Project Settings</span>
              <span className="text-xs text-muted-foreground">
                {project.name}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {(!workspace || !project) && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {!workspace && "Select a workspace to access workspace settings"}
              {workspace &&
                !project &&
                "Select a project to access project settings"}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
