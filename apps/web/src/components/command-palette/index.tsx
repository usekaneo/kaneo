import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { KbdSequence } from "@/components/ui/kbd";
import { useUserPreferencesStore } from "@/store/user-preferences";
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
import { useEffect, useState } from "react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useUserPreferencesStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => unknown) => {
    setOpen(false);
    command();
  };

  return (
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
            onSelect={() => runCommand(() => console.log("Go to Dashboard"))}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log("Search"))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Search</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Go to Team"))}
          >
            <Users className="mr-2 h-4 w-4" />
            <span>Team</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Go to Settings"))}
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
  );
}
