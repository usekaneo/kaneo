import { useNavigate } from "@tanstack/react-router";
import {
  FileText,
  FolderKanban,
  Hash,
  MessageSquare,
  Search,
  Users,
  Zap,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@/components/ui/command";
import { shortcuts } from "@/constants/shortcuts";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";

type SearchResultItem = {
  id: string;
  title: string;
  description?: string;
  content?: string;
  type: "task" | "project" | "workspace" | "comment" | "activity";
  projectId?: string;
  workspaceId?: string;
  taskNumber?: number;
  projectSlug?: string;
  priority?: string;
  status?: string;
};

type SearchGroup = {
  value: string;
  label: string;
  items: SearchResultItem[];
};

type SearchCommandMenuProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

function SearchCommandMenu({ open, setOpen }: SearchCommandMenuProps) {
  const [query, setQuery] = useState("");
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const searchEnabled = query.trim().length >= 3;

  const { data: searchResults } = useGlobalSearch({
    q: query,
    type: "all",
    workspaceId: workspace?.id,
    limit: 20,
  });

  useRegisterShortcuts({
    shortcuts: {
      [shortcuts.search.prefix]: () => {
        setOpen(true);
      },
    },
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const handleSelect = (item: SearchResultItem) => {
    setOpen(false);
    setQuery("");

    switch (item.type) {
      case "task":
        if (item.projectId && item.id && workspace?.id) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: workspace.id,
              projectId: item.projectId,
              taskId: item.id,
            },
          });
        }
        break;
      case "project":
        if (item.id && workspace?.id) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: {
              workspaceId: workspace.id,
              projectId: item.id,
            },
          });
        }
        break;
      case "workspace":
        if (item.id) {
          navigate({
            to: "/dashboard/workspace/$workspaceId",
            params: {
              workspaceId: item.id,
            },
          });
        }
        break;
      case "comment":
      case "activity":
        if (item.projectId && item.id && workspace?.id) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: workspace.id,
              projectId: item.projectId,
              taskId: item.id,
            },
          });
        }
        break;
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "task":
        return Hash;
      case "project":
        return FolderKanban;
      case "workspace":
        return Users;
      case "comment":
        return MessageSquare;
      case "activity":
        return Zap;
      default:
        return FileText;
    }
  };

  const getGroupLabel = (type: string) => {
    switch (type) {
      case "task":
        return "Tasks";
      case "project":
        return "Projects";
      case "workspace":
        return "Workspaces";
      case "comment":
        return "Comments";
      case "activity":
        return "Activities";
      default:
        return "Results";
    }
  };

  const groupedItems = useMemo<SearchGroup[]>(() => {
    if (!searchEnabled) return [];
    const results = (searchResults?.results ?? []) as SearchResultItem[];
    const grouped = results.reduce(
      (acc: Record<string, SearchResultItem[]>, item: SearchResultItem) => {
        if (!acc[item.type]) acc[item.type] = [];
        acc[item.type].push(item);
        return acc;
      },
      {} as Record<string, SearchResultItem[]>,
    );

    return Object.entries(grouped).map(([type, items]) => ({
      value: type,
      label: getGroupLabel(type),
      items,
    }));
  }, [searchEnabled, searchResults?.results]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search for tasks, projects, comments, and more"
    >
      <CommandDialogPopup>
        <Command items={groupedItems}>
          <CommandInput
            placeholder="Search tasks, projects, comments..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandPanel>
            <CommandEmpty>
              <div className="text-center py-6">
                <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {searchEnabled
                    ? "No results found."
                    : "Type at least 3 characters to search"}
                </p>
              </div>
            </CommandEmpty>
            <CommandList>
              {(group: SearchGroup, groupIndex: number) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.label}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: SearchResultItem) => {
                        const Icon = getItemIcon(item.type);
                        return (
                          <CommandItem
                            key={`${item.type}-${item.id}`}
                            value={`${item.title} ${item.description || ""} ${item.type} ${item.id}`}
                            onClick={() => handleSelect(item)}
                            className="flex items-start gap-3 py-3"
                            aria-label={`${item.type}: ${item.title}`}
                          >
                            <Icon
                              className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0"
                              aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {item.title}
                              </div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground truncate mt-1">
                                  {item.description}
                                </div>
                              )}
                            </div>
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
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}

export default SearchCommandMenu;
