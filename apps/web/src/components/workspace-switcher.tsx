import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, Plus } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
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
  const { isMobile } = useSidebar();
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
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div
                className="bg-indigo-600 text-white flex aspect-square size-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: "#5463ff" }}
              >
                <span className="text-sm font-semibold">
                  {workspace.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{workspace.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {workspaces?.length || 0} workspace
                  {workspaces?.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Workspaces
            </DropdownMenuLabel>
            {workspaces?.map((ws: Workspace, index: number) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => {
                  handleWorkspaceChange(ws);
                  setIsOpen(false);
                }}
                className="gap-2 p-2"
              >
                <div
                  className="flex size-6 items-center justify-center rounded-md bg-indigo-600 dark:bg-indigo-400"
                  style={{ backgroundColor: "#5463ff" }}
                >
                  <span className="text-xs font-medium text-white">
                    {ws.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                {ws.name}
                <span className="ml-auto text-xs text-muted-foreground">
                  {getModifierKeyText()} {index > 8 ? "0" : index + 1}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => {
                setIsCreateWorkspaceModalOpen(true);
              }}
            >
              <div
                className="flex size-6 items-center justify-center rounded-md bg-indigo-600 dark:bg-indigo-400"
                style={{ backgroundColor: "#5463ff" }}
              >
                <Plus className="size-4 text-white" />
              </div>
              <div className="text-muted-foreground font-medium">
                Add workspace
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateWorkspaceModal
        open={isCreateWorkspaceModalOpen}
        onClose={() => setIsCreateWorkspaceModalOpen(false)}
      />
    </SidebarMenu>
  );
}
