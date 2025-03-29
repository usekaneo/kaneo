import { cn } from "@/lib/cn";
import useWorkspaceStore from "@/store/workspace";
import ManageTeams from "./sections/manage-teams";
import WorkspaceSettings from "./sections/workspace-settings";
import Workspaces from "./sections/workspaces";

export function SidebarContent() {
  const { workspace } = useWorkspaceStore();

  return (
    <nav className="flex-1 overflow-y-auto p-3">
      <div className={cn("space-y-4")}>
        <Workspaces />
        {workspace && <ManageTeams />}
        {workspace && <WorkspaceSettings />}
      </div>
    </nav>
  );
}
