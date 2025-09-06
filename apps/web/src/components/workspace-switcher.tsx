import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/user-avatar";
import { shortcuts } from "@/constants/shortcuts";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import {
  getModifierKeyText,
  useRegisterShortcuts,
} from "@/hooks/use-keyboard-shortcuts";
import { useUserPreferencesStore } from "@/store/user-preferences";
import useWorkspaceStore from "@/store/workspace";
import type { Workspace } from "@/types/workspace";
import CreateWorkspaceModal from "./shared/modals/create-workspace-modal";

export function WorkspaceSwitcher() {
  const { workspace, setWorkspace } = useWorkspaceStore();
  const { setActiveWorkspaceId } = useUserPreferencesStore();
  const { data: workspaces } = useGetWorkspaces();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] =
    React.useState(false);

  const handleWorkspaceChange = React.useCallback(
    (selectedWorkspace: Workspace) => {
      setWorkspace(selectedWorkspace);
      setActiveWorkspaceId(selectedWorkspace.id);
      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: selectedWorkspace.id },
      });
    },
    [setWorkspace, setActiveWorkspaceId, navigate],
  );

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!workspaces || workspaces.length === 0) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key >= "1" &&
        event.key <= "9"
      ) {
        event.preventDefault();
        const index = Number.parseInt(event.key) - 1;
        if (index < workspaces.length) {
          handleWorkspaceChange(workspaces[index]);
          setIsOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, workspaces, handleWorkspaceChange]);

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.workspace.prefix]: {
        [shortcuts.workspace.switch]: () => {
          setIsOpen(true);
        },
        [shortcuts.workspace.create]: () => {
          setIsCreateWorkspaceModalOpen(true);
        },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between w-full gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="sm"
                  className="h-8 py-0 w-auto w-full group"
                >
                  <div className="flex items-end gap-2 min-w-0 w-full">
                    <div className="bg-primary flex aspect-square size-5 items-end justify-center rounded-sm">
                      <span className="text-xs font-medium text-white">
                        {workspace.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate text-sm text-foreground/90 font-medium">
                      {workspace.name}
                    </span>
                  </div>
                  <ChevronDown
                    className="ml-1 size-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 data-[state=open]:rotate-180 transition-all duration-500 ease-out"
                    data-state={isOpen ? "open" : "closed"}
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-48 rounded-md border-border/20"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-muted-foreground/60 text-xs px-3 py-2">
                  Workspaces
                </DropdownMenuLabel>
                {workspaces?.map((ws: Workspace, index: number) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => {
                      handleWorkspaceChange(ws);
                      setIsOpen(false);
                    }}
                    className="gap-2 px-3 py-1.5 hover:bg-secondary/80 focus:bg-secondary/80"
                  >
                    <div className="bg-muted/20 border border-border/30 flex size-5 items-center justify-center rounded-sm">
                      <span className="text-xs font-medium text-muted-foreground">
                        {ws.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-foreground/90">
                      {ws.name}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground/50">
                      {getModifierKeyText()} {index > 8 ? "0" : index + 1}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="border-border/20" />
                <DropdownMenuItem
                  className="gap-2 px-3 py-1.5 hover:bg-card/30 focus:bg-card/30"
                  onClick={() => {
                    setIsCreateWorkspaceModalOpen(true);
                  }}
                >
                  <div className="bg-muted/20 border border-border/30 flex size-5 items-center justify-center rounded-sm">
                    <Plus className="size-3 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Add workspace
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <UserAvatar />
      </div>

      <CreateWorkspaceModal
        open={isCreateWorkspaceModalOpen}
        onClose={() => setIsCreateWorkspaceModalOpen(false)}
      />
    </>
  );
}
