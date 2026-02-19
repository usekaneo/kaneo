import { Archive, ArrowDownToLine, Menu, Trash2, X } from "lucide-react";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import { Button } from "../ui/button";

type BulkActionItem = {
  value: string;
  label: string;
  icon?: ReactNode;
  onRun: () => void;
};

type BulkActionGroup = {
  value: string;
  label: string;
  items: BulkActionItem[];
};

function BulkToolbar() {
  const { selectedTaskIds, clearSelection, selectAll } =
    useBulkSelectionStore();
  const { project } = useProjectStore();
  const {
    bulkMoveToBacklog,
    bulkDelete,
    bulkArchive,
    bulkChangeStatus,
    bulkAssign,
  } = useBulkOperations();
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

  const handleMoveToBacklog = useCallback(async () => {
    try {
      await bulkMoveToBacklog(Array.from(selectedTaskIds));
      toast.success(`${selectedCount} tasks moved to backlog`);
      clearSelection();
    } catch (_error) {
      toast.error("Failed to move tasks to backlog");
    }
  }, [bulkMoveToBacklog, selectedTaskIds, selectedCount, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
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
  }, [bulkDelete, selectedTaskIds, selectedCount, clearSelection]);

  const handleBulkArchive = useCallback(async () => {
    try {
      await bulkArchive(Array.from(selectedTaskIds));
      toast.success(`${selectedCount} tasks archived`);
      clearSelection();
      setIsActionsOpen(false);
    } catch (_error) {
      toast.error("Failed to archive tasks");
    }
  }, [bulkArchive, selectedTaskIds, selectedCount, clearSelection]);

  const handleBulkChangeStatus = useCallback(
    async (status: string) => {
      try {
        await bulkChangeStatus({
          taskIds: Array.from(selectedTaskIds),
          status,
        });
        toast.success(`${selectedCount} tasks updated`);
        clearSelection();
        setIsActionsOpen(false);
      } catch (_error) {
        toast.error("Failed to update tasks");
      }
    },
    [bulkChangeStatus, selectedTaskIds, selectedCount, clearSelection],
  );

  const handleBulkAssign = useCallback(
    async (userId: string) => {
      try {
        await bulkAssign({ taskIds: Array.from(selectedTaskIds), userId });
        toast.success(`${selectedCount} tasks assigned`);
        clearSelection();
        setIsActionsOpen(false);
      } catch (_error) {
        toast.error("Failed to assign tasks");
      }
    },
    [bulkAssign, selectedTaskIds, selectedCount, clearSelection],
  );

  const groupedItems = useMemo<BulkActionGroup[]>(
    () => [
      {
        value: "actions",
        label: "Actions",
        items: [
          {
            value: "bulk-delete",
            label: "Delete tasks",
            icon: <Trash2 className="w-4 h-4 mr-2" />,
            onRun: () => {
              void handleBulkDelete();
            },
          },
          {
            value: "bulk-archive",
            label: "Archive tasks",
            icon: <Archive className="w-4 h-4 mr-2" />,
            onRun: () => {
              void handleBulkArchive();
            },
          },
        ],
      },
      {
        value: "status",
        label: "Change Status",
        items: (project?.columns ?? []).map((col) => ({
          value: `status-${col.id}`,
          label: col.name,
          icon: getColumnIcon(col.id, col.isFinal),
          onRun: () => {
            void handleBulkChangeStatus(col.id);
          },
        })),
      },
      {
        value: "assign",
        label: "Assign to",
        items: (workspaceUsers?.members ?? []).map((member) => ({
          value: `assign-${member.userId}`,
          label: member.user?.name || "Unknown User",
          icon: (
            <Avatar className="h-6 w-6 mr-2">
              <AvatarImage
                src={member.user?.image ?? ""}
                alt={member.user?.name || ""}
              />
              <AvatarFallback className="text-xs font-medium border border-border/30">
                {member.user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ),
          onRun: () => {
            void handleBulkAssign(member.userId);
          },
        })),
      },
    ],
    [
      project?.columns,
      workspaceUsers?.members,
      handleBulkDelete,
      handleBulkArchive,
      handleBulkChangeStatus,
      handleBulkAssign,
    ],
  );

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

        <Button size="sm" variant="ghost" onClick={handleMoveToBacklog}>
          <ArrowDownToLine className="size-4" />
          Move to Backlog
        </Button>

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
        <CommandDialogPopup>
          <Command items={groupedItems}>
            <CommandInput placeholder="Search actions..." />
            <CommandPanel>
              <CommandEmpty>No actions found.</CommandEmpty>
              <CommandList>
                {(group: BulkActionGroup, groupIndex: number) => (
                  <Fragment key={group.value}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.label}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: BulkActionItem) => (
                          <CommandItem
                            key={item.value}
                            value={item.value}
                            onClick={item.onRun}
                          >
                            {item.icon}
                            <span className="text-sm">{item.label}</span>
                          </CommandItem>
                        )}
                      </CommandCollection>
                    </CommandGroup>
                    {groupIndex < groupedItems.length - 1 && (
                      <CommandSeparator />
                    )}
                  </Fragment>
                )}
              </CommandList>
            </CommandPanel>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
    </div>
  );
}

export default BulkToolbar;
