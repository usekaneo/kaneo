import SearchCommandMenu from "@/components/search-command-menu";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import CreateWorkspaceModal from "@/components/shared/modals/create-workspace-modal";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { KbdSequence } from "@/components/ui/kbd";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useUserPreferencesStore } from "@/store/user-preferences";
import useWorkspaceStore from "@/store/workspace";
import { useNavigate } from "@tanstack/react-router";
import {
  FolderKanban,
  LayoutDashboard,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { useState } from "react";
import CreateProjectModal from "../shared/modals/create-project-modal";

function CommandPalette() {
  const { theme, setTheme } = useUserPreferencesStore();
  const navigate = useNavigate();
  const { workspace } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);

  useRegisterShortcuts({
    modifierShortcuts: {
      [shortcuts.palette.prefix]: {
        [shortcuts.palette.open]: () => {
          setOpen(true);
        },
      },
    },
    sequentialShortcuts: {
      [shortcuts.task.prefix]: {
        [shortcuts.task.create]: () => setIsCreateTaskOpen(true),
      },
      [shortcuts.project.prefix]: {
        [shortcuts.project.create]: () => setIsCreateProjectOpen(true),
      },
      [shortcuts.workspace.prefix]: {
        [shortcuts.workspace.create]: () => {
          setIsCreateWorkspaceOpen(true);
        },
      },
    },
  });

  const runCommand = (command: () => unknown) => {
    command();
    setOpen(false);
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Create">
            <CommandItem
              onSelect={() => {
                runCommand(() => {
                  setIsCreateTaskOpen(true);
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Create task</span>
              <KbdSequence
                keys={[shortcuts.task.prefix, shortcuts.task.create]}
                className="ml-auto"
              />
            </CommandItem>
            <CommandItem
              onSelect={() => {
                runCommand(() => {
                  setIsCreateProjectOpen(true);
                });
              }}
            >
              <FolderKanban className="mr-2 h-4 w-4" />
              <span>Create project</span>
              <KbdSequence
                keys={[shortcuts.project.prefix, shortcuts.project.create]}
                className="ml-auto"
              />
            </CommandItem>
            <CommandItem
              onSelect={() => {
                runCommand(() => {
                  setIsCreateWorkspaceOpen(true);
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Create workspace</span>
              <KbdSequence
                keys={[shortcuts.workspace.prefix, shortcuts.workspace.create]}
                className="ml-auto"
              />
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() =>
                runCommand(() =>
                  navigate({
                    to: "/dashboard/workspace/$workspaceId",
                    params: { workspaceId: workspace?.id ?? "" },
                  }),
                )
              }
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Projects</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setIsSearchOpen(true);
                })
              }
            >
              <Search className="mr-2 h-4 w-4" />
              <span>Search</span>
              <KbdSequence
                keys={[shortcuts.search.prefix]}
                className="ml-auto"
              />
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() =>
                  navigate({
                    to: "/dashboard/workspace/$workspaceId/members",
                    params: { workspaceId: workspace?.id ?? "" },
                  }),
                )
              }
            >
              <Users className="mr-2 h-4 w-4" />
              <span>Members</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() =>
                  navigate({
                    to: "/dashboard/workspace/$workspaceId/settings",
                    params: { workspaceId: workspace?.id ?? "" },
                  }),
                )
              }
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Theme">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setTheme("light");
                })
              }
            >
              <Sun className="mr-2 h-4 w-4" />
              <span>Light theme</span>
              {theme === "light" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
              )}
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setTheme("dark");
                })
              }
            >
              <Moon className="mr-2 h-4 w-4" />
              <span>Dark theme</span>
              {theme === "dark" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
              )}
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setTheme("system");
                })
              }
            >
              <Monitor className="mr-2 h-4 w-4" />
              <span>System theme</span>
              {theme === "system" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
              )}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <SearchCommandMenu open={isSearchOpen} setOpen={setIsSearchOpen} />
      <CreateTaskModal
        open={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
      />
      <CreateWorkspaceModal
        open={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
      />
      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </>
  );
}

export default CommandPalette;
