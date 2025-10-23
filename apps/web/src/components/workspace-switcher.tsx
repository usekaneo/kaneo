import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
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

  const handleWorkspaceChange = React.useCallback(
    async (selectedWorkspace: Workspace) => {
      try {
        await authClient.organization.setActive({
          organizationId: selectedWorkspace.id,
        });

        navigate({
          to: "/dashboard/workspace/$workspaceId",
          params: { workspaceId: selectedWorkspace.id },
        });
      } catch (error) {
        console.error("Failed to switch workspace:", error);
      }
    },
    [navigate],
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
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
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
              </PopoverTrigger>
              <PopoverContent
                className="w-fit min-w-48 p-0 rounded-lg"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <div className="p-3">
                  <div className="text-muted-foreground/60 text-xs">
                    Workspaces
                  </div>
                </div>

                <Separator />

                <div className="p-1">
                  {workspaces?.map((ws: Workspace, index: number) => (
                    <button
                      type="button"
                      key={ws.id}
                      onClick={() => {
                        handleWorkspaceChange(ws);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/80 focus:bg-secondary/80 rounded-sm transition-colors text-sm font-normal"
                    >
                      <div className="bg-muted/20 border border-border/30 flex size-5 items-center justify-center rounded-sm">
                        <span className="text-xs font-medium text-muted-foreground">
                          {ws.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-foreground/90 flex-1 text-left">
                        {ws.name}
                      </span>
                      <span className="text-xs text-muted-foreground/50">
                        {getModifierKeyText()} {index > 8 ? "0" : index + 1}
                      </span>
                    </button>
                  ))}
                </div>

                <Separator />

                <div className="p-1">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/80 focus:bg-secondary/80 rounded-sm transition-colors text-sm font-normal"
                    onClick={() => {
                      setIsCreateWorkspaceModalOpen(true);
                      setIsOpen(false);
                    }}
                  >
                    <div className="bg-muted/20 border border-border/30 flex size-5 items-center justify-center rounded-sm">
                      <Plus className="size-3 text-muted-foreground" />
                    </div>
                    <span className="text-muted-foreground flex-1 text-left">
                      Add workspace
                    </span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
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
