import {
  Archive,
  ArrowUpToLine,
  ChevronDown,
  Menu,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import useBacklogBulkSelectionStore from "@/store/backlog-bulk-selection";
import useProjectStore from "@/store/project";
import { Button } from "../ui/button";

function BacklogBulkToolbar() {
  const { selectedTaskIds, clearSelection, selectAll } =
    useBacklogBulkSelectionStore();
  const { project } = useProjectStore();
  const { bulkMoveToBoard, bulkDelete, bulkArchive, bulkAssign } =
    useBulkOperations();
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const selectedCount = selectedTaskIds.size;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }

      if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectAll, clearSelection]);

  const handleMoveToBoard = async (status: string) => {
    try {
      await bulkMoveToBoard({
        taskIds: Array.from(selectedTaskIds),
        status,
      });
      toast.success(`${selectedCount} tasks moved to board`);
      clearSelection();
    } catch (_error) {
      toast.error("Failed to move tasks to board");
    }
  };

  const handleBulkDelete = async () => {
    if (
      !confirm(`Delete ${selectedCount} tasks? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      await bulkDelete(Array.from(selectedTaskIds));
      toast.success(`${selectedCount} tasks deleted`);
      clearSelection();
      setIsActionsOpen(false);
    } catch (_error) {
      toast.error("Failed to delete tasks");
    }
  };

  const handleBulkArchive = async () => {
    try {
      await bulkArchive(Array.from(selectedTaskIds));
      toast.success(`${selectedCount} tasks archived`);
      clearSelection();
      setIsActionsOpen(false);
    } catch (_error) {
      toast.error("Failed to archive tasks");
    }
  };

  const handleBulkAssign = async (userId: string) => {
    try {
      await bulkAssign({ taskIds: Array.from(selectedTaskIds), userId });
      toast.success(`${selectedCount} tasks assigned`);
      clearSelection();
      setIsActionsOpen(false);
    } catch (_error) {
      toast.error("Failed to assign tasks");
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-background text-foreground rounded-xl shadow-lg px-2 py-2 flex items-center gap-1 border border-border">
        <div className="flex items-center gap-1.5 px-3">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} selected
          </span>
        </div>

        <div className="w-px h-6 bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-1.5">
              <ArrowUpToLine className="size-4" />
              Move to Board
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            {(project?.columns ?? []).map((col) => (
              <DropdownMenuItem
                key={col.id}
                onClick={() => handleMoveToBoard(col.id)}
              >
                {getColumnIcon(col.id)}
                <span className="ml-2">{col.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-border" />

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsActionsOpen(true)}
        >
          <Menu className="size-4" />
          Actions
        </Button>

        <div className="w-px h-6 bg-border" />

        <Button size="sm" variant="ghost" onClick={clearSelection}>
          <X className="size-4" />
        </Button>
      </div>

      <CommandDialog
        title="Bulk Actions"
        open={isActionsOpen}
        onOpenChange={setIsActionsOpen}
      >
        <CommandInput placeholder="Search actions..." />
        <CommandList>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={handleBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete tasks
            </CommandItem>
            <CommandItem onSelect={handleBulkArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Archive tasks
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Assign to">
            {workspaceUsers?.members?.map((member) => (
              <CommandItem
                key={member.userId}
                onSelect={() => handleBulkAssign(member.userId)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={member.user?.image ?? ""}
                    alt={member.user?.name || ""}
                  />
                  <AvatarFallback className="text-xs font-medium border border-border/30">
                    {member.user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {member.user?.name || "Unknown User"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export default BacklogBulkToolbar;
