import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";
import useWorkspaceStore from "@/store/workspace";
import { Link } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";
import { Settings } from "lucide-react";

function WorkspaceSettings() {
  const { workspace } = useWorkspaceStore();
  const location = useLocation();
  const { isSidebarOpened } = useUserPreferencesStore();
  const isOnWorkspaceRoute = location.pathname.includes("/workspace-settings");

  if (!workspace) return null;

  return (
    <div>
      <h2
        className={cn(
          "text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2",
          isSidebarOpened && "px-3",
        )}
      >
        {isSidebarOpened && "Workspace"}
      </h2>
      <Link
        to={"/dashboard/workspace-settings/$workspaceId"}
        params={{ workspaceId: workspace.id }}
        className={cn(
          "flex items-center gap-2 text-sm justify-center py-1.5 rounded-md",
          isOnWorkspaceRoute
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100",
          isSidebarOpened && "justify-start px-3",
        )}
      >
        <Settings
          className={cn(
            "shrink-0",
            !isSidebarOpened ? "w-6 h-6" : "w-4 h-4 mr-2",
          )}
        />
        {isSidebarOpened && "Settings"}
      </Link>
    </div>
  );
}

export default WorkspaceSettings;
