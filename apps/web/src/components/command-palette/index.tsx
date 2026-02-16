import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CornerDownLeftIcon,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import SearchCommandMenu from "@/components/search-command-menu";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import CreateWorkspaceModal from "@/components/shared/modals/create-workspace-modal";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { shortcuts } from "@/constants/shortcuts";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useUserPreferencesStore } from "@/store/user-preferences";
import CreateProjectModal from "../shared/modals/create-project-modal";

type PaletteActionItem = {
  value: string;
  label: string;
  shortcut?: string;
  onRun: () => void;
};

type PaletteGroup = {
  value: string;
  label: string;
  items: PaletteActionItem[];
};

function CommandPalette() {
  const { setTheme } = useUserPreferencesStore();
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const [open, setOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);

  useRegisterShortcuts({
    shortcuts: {
      [shortcuts.help.key]: () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
      },
    },
    modifierShortcuts: {
      [shortcuts.palette.prefix]: {
        [shortcuts.palette.open]: () => {
          setOpen(true);
        },
      },
    },
    sequentialShortcuts: {
      [shortcuts.project.prefix]: {
        [shortcuts.project.list]: () => {
          if (!workspace?.id) return;
          navigate({
            to: "/dashboard/workspace/$workspaceId",
            params: { workspaceId: workspace.id },
          });
        },
        [shortcuts.project.create]: () => setIsCreateProjectOpen(true),
      },
      [shortcuts.task.prefix]: {
        [shortcuts.task.create]: () => setIsCreateTaskOpen(true),
      },
      [shortcuts.workspace.prefix]: {
        [shortcuts.workspace.create]: () => {
          setIsCreateWorkspaceOpen(true);
        },
      },
    },
  });

  const runCommand = (command: () => void) => {
    command();
    setOpen(false);
  };

  const groupedItems = useMemo<PaletteGroup[]>(
    () => [
      {
        value: "suggestions",
        label: "Suggestions",
        items: [
          {
            value: "projects",
            label: "Projects",
            shortcut: `${shortcuts.project.prefix} ${shortcuts.project.list}`,
            onRun: () => {
              if (!workspace?.id) return;
              navigate({
                to: "/dashboard/workspace/$workspaceId",
                params: { workspaceId: workspace.id },
              });
            },
          },
          {
            value: "search",
            label: "Search",
            shortcut: shortcuts.search.prefix,
            onRun: () => setIsSearchOpen(true),
          },
          {
            value: "members",
            label: "Members",
            onRun: () => {
              if (!workspace?.id) return;
              navigate({
                to: "/dashboard/workspace/$workspaceId/members",
                params: { workspaceId: workspace.id },
              });
            },
          },
          {
            value: "create-task",
            label: "Create task",
            shortcut: `${shortcuts.task.prefix} ${shortcuts.task.create}`,
            onRun: () => setIsCreateTaskOpen(true),
          },
          {
            value: "create-project",
            label: "Create project",
            shortcut: `${shortcuts.project.prefix} ${shortcuts.project.create}`,
            onRun: () => setIsCreateProjectOpen(true),
          },
        ],
      },
      {
        value: "commands",
        label: "Commands",
        items: [
          {
            value: "create-workspace",
            label: "Create workspace",
            shortcut: `${shortcuts.workspace.prefix} ${shortcuts.workspace.create}`,
            onRun: () => setIsCreateWorkspaceOpen(true),
          },
          {
            value: "theme-light",
            label: "Light theme",
            onRun: () => setTheme("light"),
          },
          {
            value: "theme-dark",
            label: "Dark theme",
            onRun: () => setTheme("dark"),
          },
          {
            value: "theme-system",
            label: "System theme",
            onRun: () => setTheme("system"),
          },
          {
            value: "keyboard-shortcuts",
            label: "Keyboard shortcuts",
            shortcut: "?",
            onRun: () => {
              setTimeout(() => {
                document.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "?" }),
                );
              }, 100);
            },
          },
        ],
      },
    ],
    [navigate, setTheme, workspace?.id],
  );

  const shortcutHandlers = useMemo(() => {
    const handlers = new Map<string, () => void>();
    for (const group of groupedItems) {
      for (const item of group.items) {
        if (!item.shortcut) continue;
        handlers.set(item.shortcut.replace(/\s+/g, "").toLowerCase(), item.onRun);
      }
    }
    return handlers;
  }, [groupedItems]);

  useEffect(() => {
    if (!open) return;

    let sequence = "";
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key === "Shift") {
        return;
      }

      if (event.key.length !== 1 && event.key !== "?") {
        return;
      }

      sequence = `${sequence}${event.key.toLowerCase()}`.slice(-3);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        sequence = "";
      }, 700);

      const handler = shortcutHandlers.get(sequence);
      if (!handler) return;

      event.preventDefault();
      runCommand(handler);
      sequence = "";
      clearTimeout(timeout);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, shortcutHandlers]);

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandDialogPopup className="max-w-4xl">
          <Command items={groupedItems}>
            <CommandInput placeholder="Search for apps and commands..." />
            <CommandPanel>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandList>
                {(group: PaletteGroup, groupIndex: number) => (
                  <Fragment key={group.value}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.label}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: PaletteActionItem) => {
                          return (
                            <CommandItem
                              key={item.value}
                              value={item.value}
                              onClick={() => runCommand(item.onRun)}
                              className="px-3"
                            >
                              <span className="flex-1">{item.label}</span>
                              {item.shortcut && (
                                <CommandShortcut>{item.shortcut}</CommandShortcut>
                              )}
                            </CommandItem>
                          );
                        }}
                      </CommandCollection>
                    </CommandGroup>
                    {groupIndex < groupedItems.length - 1 && <CommandSeparator />}
                  </Fragment>
                )}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <KbdGroup>
                    <Kbd>
                      <ArrowUpIcon />
                    </Kbd>
                    <Kbd>
                      <ArrowDownIcon />
                    </Kbd>
                  </KbdGroup>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-2">
                  <Kbd>
                    <CornerDownLeftIcon />
                  </Kbd>
                  <span>Open</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Kbd>Esc</Kbd>
                <span>Close</span>
              </div>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
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
