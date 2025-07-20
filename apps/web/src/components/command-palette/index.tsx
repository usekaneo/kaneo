import SearchCommandMenu from "@/components/search-command-menu";
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
  Hash,
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

function CommandPalette() {
  const { theme, setTheme } = useUserPreferencesStore();
  const navigate = useNavigate();
  const { workspace } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useRegisterShortcuts({
    modifierShortcuts: {
      [shortcuts.palette.prefix]: {
        [shortcuts.palette.open]: () => {
          setOpen(true);
        },
      },
    },
  });

  const runCommand = (command: () => unknown) => {
    command();
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Create">
            <CommandItem
              onSelect={() => runCommand(() => console.log("Create task"))}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Create task</span>
              <KbdSequence keys={["C"]} className="ml-auto" />
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => console.log("Create project"))}
            >
              <FolderKanban className="mr-2 h-4 w-4" />
              <span>Create project</span>
              <KbdSequence keys={["P", "C"]} className="ml-auto" />
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => console.log("Create label"))}
            >
              <Hash className="mr-2 h-4 w-4" />
              <span>Create label</span>
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
                  setOpen(false);
                  setIsSearchOpen(true);
                })
              }
            >
              <Search className="mr-2 h-4 w-4" />
              <span>Search</span>
              <KbdSequence keys={["/"]} className="ml-auto" />
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
            <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
              <Sun className="mr-2 h-4 w-4" />
              <span>Light theme</span>
              {theme === "light" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
              )}
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
              <Moon className="mr-2 h-4 w-4" />
              <span>Dark theme</span>
              {theme === "dark" && (
                <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
              )}
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
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
    </>
  );
}

export default CommandPalette;
