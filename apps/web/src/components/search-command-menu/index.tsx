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
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import useWorkspaceStore from "@/store/workspace";
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
import { useEffect, useState } from "react";

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

type SearchCommandMenuProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

function SearchCommandMenu({ open, setOpen }: SearchCommandMenuProps) {
  const [query, setQuery] = useState("");
  const { workspace } = useWorkspaceStore();
  const navigate = useNavigate();

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

  const groupedResults = searchResults?.results?.reduce(
    (acc: Record<string, SearchResultItem[]>, item: SearchResultItem) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<string, SearchResultItem[]>,
  );

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

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search for tasks, projects, comments, and more"
    >
      <CommandInput
        placeholder="Search tasks, projects, comments..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.length <= 2 && (
          <CommandEmpty>
            <div className="text-center py-6">
              <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Type at least 3 characters to search
              </p>
              <div className="mt-2 text-xs text-muted-foreground">
                Press <KbdSequence keys={["/"]} className="inline-flex" /> to
                focus
              </div>
            </div>
          </CommandEmpty>
        )}

        {groupedResults &&
          Object.keys(groupedResults).length > 0 &&
          Object.entries(groupedResults).map(([type, items]) =>
            items.length > 0 ? (
              <CommandGroup key={type} heading={getGroupLabel(type)}>
                {items.map((item) => {
                  const Icon = getItemIcon(item.type);
                  return (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      onSelect={() => handleSelect(item)}
                      className="flex items-start gap-3 py-3"
                      value={`${item.title} ${item.description || ""} ${item.type} ${item.id}`}
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
                })}
              </CommandGroup>
            ) : null,
          )}
      </CommandList>
    </CommandDialog>
  );
}

export default SearchCommandMenu;
