import { ChevronsUpDown } from "lucide-react";
import { useState } from "react";
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
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";

type WorkspaceCrumbSelectProps = {
  workspaceId?: string;
  workspaceName?: string;
  onSelectWorkspace: (workspaceId: string) => Promise<void> | void;
};

type WorkspaceOption = {
  id: string;
  name: string;
};

export default function WorkspaceCrumbSelect({
  workspaceId,
  workspaceName,
  onSelectWorkspace,
}: WorkspaceCrumbSelectProps) {
  const { data: workspaces = [] } = useGetWorkspaces();
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<
    string | null
  >(null);

  const workspaceOptions = (workspaces ?? []).filter(
    (workspace): workspace is WorkspaceOption =>
      typeof workspace?.id === "string" && typeof workspace?.name === "string",
  );

  const handleSelectWorkspace = async (nextWorkspaceId: string) => {
    if (nextWorkspaceId === workspaceId || switchingWorkspaceId) {
      return;
    }

    setSwitchingWorkspaceId(nextWorkspaceId);
    try {
      await onSelectWorkspace(nextWorkspaceId);
    } finally {
      setSwitchingWorkspaceId(null);
    }
  };

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
          {workspaceName || "Select workspace"}
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
            Workspaces
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {workspaceOptions.length > 0 ? (
            workspaceOptions.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                disabled={
                  workspace.id === workspaceId ||
                  (switchingWorkspaceId !== null &&
                    switchingWorkspaceId !== workspace.id)
                }
                onClick={() => handleSelectWorkspace(workspace.id)}
                className="h-8 text-sm"
              >
                <span className="truncate">
                  {switchingWorkspaceId === workspace.id
                    ? "Switching..."
                    : workspace.name}
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem
              disabled
              className="h-8 text-sm text-muted-foreground"
            >
              No workspaces
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
