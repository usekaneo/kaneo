import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/user-avatar";
import { shortcuts } from "@/constants/shortcuts";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import {
  getModifierKeyText,
  useRegisterShortcuts,
} from "@/hooks/use-keyboard-shortcuts";
import { authClient } from "@/lib/auth-client";
import type { Workspace } from "@/types/workspace";
import CreateWorkspaceModal from "./shared/modals/create-workspace-modal";

export function WorkspaceSwitcher() {
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaces } = useGetWorkspaces();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] =
    React.useState(false);
  const [isSwitching, setIsSwitching] = React.useState(false);

  const handleWorkspaceChange = React.useCallback(
    async (selectedWorkspace: Workspace) => {
      if (isSwitching) return;

      setIsSwitching(true);
      try {
        await authClient.organization.setActive({
          organizationId: selectedWorkspace.id,
        });

        setTimeout(() => {
          navigate({
            to: "/dashboard/workspace/$workspaceId",
            params: { workspaceId: selectedWorkspace.id },
          });
        }, 50);
      } catch (error) {
        console.error("Failed to switch workspace:", error);
      } finally {
        setTimeout(() => setIsSwitching(false), 100);
      }
    },
    [navigate, isSwitching],
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
        const index = Number.parseInt(event.key, 10) - 1;
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
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    className="group h-8 w-full rounded-md px-2 text-sidebar-foreground data-[active=true]:bg-sidebar-accent/50"
                    size="default"
                  />
                }
              >
                <div className="flex items-center min-w-0 w-full">
                  <span
                    className={`truncate text-sm font-medium text-sidebar-foreground ${isSwitching ? "opacity-50" : ""}`}
                  >
                    {workspace.name}
                  </span>
                </div>
                <ChevronDown
                  className={`ml-1 size-3.5 text-sidebar-foreground/72 opacity-90 group-hover:opacity-100 data-[state=open]:opacity-100 data-[state=open]:rotate-180 transition-all duration-200 ease-out ${isSwitching ? "animate-spin" : ""}`}
                  data-state={isOpen ? "open" : "closed"}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-(--anchor-width) text-sidebar-foreground"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                {workspaces?.map((ws: Workspace, index: number) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => {
                      if (!isSwitching && ws.id !== workspace.id) {
                        handleWorkspaceChange(ws);
                        setIsOpen(false);
                      }
                    }}
                    disabled={isSwitching || ws.id === workspace.id}
                    className="h-7 text-sm data-highlighted:bg-sidebar-accent data-highlighted:text-sidebar-accent-foreground"
                  >
                    <span className="flex-1 text-left">
                      {isSwitching && ws.id === workspace?.id
                        ? "Switching..."
                        : ws.name}
                    </span>
                    <DropdownMenuShortcut>
                      {getModifierKeyText()} {index > 8 ? "0" : index + 1}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setIsCreateWorkspaceModalOpen(true);
                    setIsOpen(false);
                  }}
                  className="h-7 text-sm data-highlighted:bg-sidebar-accent data-highlighted:text-sidebar-accent-foreground"
                >
                  <span>Add workspace</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="h-7 w-7 shrink-0">
          <UserAvatar />
        </div>
      </div>

      <CreateWorkspaceModal
        open={isCreateWorkspaceModalOpen}
        onClose={() => setIsCreateWorkspaceModalOpen(false)}
      />
    </>
  );
}
