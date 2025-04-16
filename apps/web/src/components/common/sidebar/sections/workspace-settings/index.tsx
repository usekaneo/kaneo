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
    <Link
      to={"/dashboard/workspace-settings/$workspaceId"}
      params={{ workspaceId: workspace.id }}
      className={cn(
        "flex items-center gap-2 text-sm px-3 py-1.5 rounded-md",
        isOnWorkspaceRoute
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100",
      )}
    >
      <Settings
        className={cn(
          "shrink-0",
          !isSidebarOpened ? "w-6 h-6" : "w-4 h-4 mr-2",
        )}
      />
      {isSidebarOpened && "Workspace Settings"}
    </Link>
  );
}

export default WorkspaceSettings;
