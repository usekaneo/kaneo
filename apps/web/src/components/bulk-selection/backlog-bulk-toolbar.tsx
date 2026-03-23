import {
  Archive,
  ArrowUpToLine,
  CalendarIcon,
  ChevronDown,
  Menu,
  Trash2,
  X,
} from "lucide-react";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import labelColors from "@/constants/label-colors";
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import useBacklogBulkSelectionStore from "@/store/backlog-bulk-selection";
import useProjectStore from "@/store/project";
import { Button } from "../ui/button";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../ui/toolbar";

type BacklogActionItem = {
  value: string;
  label: string;
  icon?: ReactNode;
  onRun: () => void;
};

type BacklogActionGroup = {
  value: string;
  label: string;
  items: BacklogActionItem[];
};

const priorityOptions = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "no-priority", label: "No Priority" },
];

function BacklogBulkToolbar() {
  const { selectedTaskIds, clearSelection, selectAll } =
    useBacklogBulkSelectionStore();
  const { project } = useProjectStore();
  const {
    bulkMoveToBoard,
    bulkDelete,
    bulkArchive,
    bulkAssign,
    bulkPriority,
    bulkAddLabel,
    bulkDueDate,
  } = useBulkOperations();
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(
    workspace?.id ?? "",
  );
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const selectedCount = selectedTaskIds.size;

  const uniqueLabels = useMemo(() => {
    const labelMap = new Map<string, (typeof workspaceLabels)[0]>();
    for (const label of workspaceLabels) {
      const existing = labelMap.get(label.name);
      if (!existing || (label.taskId === null && existing.taskId !== null)) {
        labelMap.set(label.name, label);
      }
    }
    return Array.from(labelMap.values());
  }, [workspaceLabels]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingContext = Boolean(
        target?.closest(
          "input, textarea, [contenteditable='true'], .ProseMirror",
        ),
      );

      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        if (isTypingContext) return;
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

  const handleMoveToBoard = useCallback(
    async (status: string) => {
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
    },
    [bulkMoveToBoard, selectedTaskIds, selectedCount, clearSelection],
  );

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

  const handleBulkPriority = useCallback(
    async (priority: string) => {
      try {
        await bulkPriority({
          taskIds: Array.from(selectedTaskIds),
          priority,
        });
        toast.success(`${selectedCount} tasks updated`);
        clearSelection();
        setIsActionsOpen(false);
      } catch (_error) {
        toast.error("Failed to update priority");
      }
    },
    [bulkPriority, selectedTaskIds, selectedCount, clearSelection],
  );

  const handleBulkAddLabel = useCallback(
    async (labelId: string) => {
      try {
        await bulkAddLabel({
          taskIds: Array.from(selectedTaskIds),
          labelId,
        });
        toast.success(`Label added to ${selectedCount} tasks`);
        clearSelection();
        setIsActionsOpen(false);
      } catch (_error) {
        toast.error("Failed to add label");
      }
    },
    [bulkAddLabel, selectedTaskIds, selectedCount, clearSelection],
  );

  const handleBulkDueDate = useCallback(
    async (date: Date | undefined) => {
      try {
        await bulkDueDate({
          taskIds: Array.from(selectedTaskIds),
          dueDate: date?.toISOString() ?? null,
        });
        toast.success(`${selectedCount} tasks updated`);
        clearSelection();
        setIsDatePickerOpen(false);
      } catch (_error) {
        toast.error("Failed to update due date");
      }
    },
    [bulkDueDate, selectedTaskIds, selectedCount, clearSelection],
  );

  const groupedItems = useMemo<BacklogActionGroup[]>(
    () => [
      {
        value: "actions",
        label: "Actions",
        items: [
          {
            value: "bulk-delete",
            label: "Delete tasks",
            icon: <Trash2 className="h-4 w-4 text-muted-foreground" />,
            onRun: () => {
              void handleBulkDelete();
            },
          },
          {
            value: "bulk-archive",
            label: "Archive tasks",
            icon: <Archive className="h-4 w-4 text-muted-foreground" />,
            onRun: () => {
              void handleBulkArchive();
            },
          },
        ],
      },
      {
        value: "assign",
        label: "Assign to",
        items: (workspaceUsers?.members ?? []).map((member) => ({
          value: `assign-${member.userId}`,
          label: member.user?.name || "Unknown User",
          icon: (
            <Avatar className="h-5 w-5">
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
      {
        value: "priority",
        label: "Set Priority",
        items: priorityOptions.map((opt) => ({
          value: `priority-${opt.value}`,
          label: opt.label,
          icon: getPriorityIcon(opt.value),
          onRun: () => {
            void handleBulkPriority(opt.value);
          },
        })),
      },
      {
        value: "label",
        label: "Add Label",
        items: uniqueLabels.map((label) => ({
          value: `label-${label.id}`,
          label: label.name,
          icon: (
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{
                backgroundColor:
                  labelColors.find((c) => c.value === label.color)?.color ||
                  "var(--color-neutral-400)",
              }}
            />
          ),
          onRun: () => {
            void handleBulkAddLabel(label.id);
          },
        })),
      },
    ],
    [
      workspaceUsers?.members,
      uniqueLabels,
      handleBulkDelete,
      handleBulkArchive,
      handleBulkAssign,
      handleBulkPriority,
      handleBulkAddLabel,
    ],
  );

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <Toolbar className="items-center gap-1 rounded-xl border-border/80 bg-background px-1.5 py-1 shadow-lg/8">
        <ToolbarGroup className="px-1.5">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} selected
          </span>
        </ToolbarGroup>

        <ToolbarSeparator orientation="vertical" className="my-1 h-5" />

        <ToolbarGroup>
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
                  {getColumnIcon(col.id, col.isFinal)}
                  <span className="ml-2">{col.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </ToolbarGroup>

        <ToolbarSeparator orientation="vertical" className="my-1 h-5" />

        <ToolbarGroup>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost">
                <CalendarIcon className="size-4" />
                Set Due Date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="center">
              <Calendar
                mode="single"
                onSelect={handleBulkDueDate}
                className="w-full bg-popover"
              />
              <div className="p-0 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground rounded-none"
                  onClick={() => handleBulkDueDate(undefined)}
                >
                  <X className="h-4 w-4" />
                  Clear date
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </ToolbarGroup>

        <ToolbarSeparator orientation="vertical" className="my-1 h-5" />

        <ToolbarGroup>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsActionsOpen(true)}
          >
            <Menu className="size-4" />
            Actions
          </Button>
        </ToolbarGroup>

        <ToolbarSeparator orientation="vertical" className="my-1 h-5" />

        <ToolbarGroup>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            <X className="size-4" />
          </Button>
        </ToolbarGroup>
      </Toolbar>

      <CommandDialog open={isActionsOpen} onOpenChange={setIsActionsOpen}>
        <CommandDialogPopup>
          <Command items={groupedItems}>
            <CommandInput placeholder="Search actions..." />
            <CommandPanel>
              <CommandEmpty>No actions found.</CommandEmpty>
              <CommandList>
                {(group: BacklogActionGroup, groupIndex: number) => (
                  <Fragment key={group.value}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.label}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: BacklogActionItem) => (
                          <CommandItem
                            key={item.value}
                            value={item.value}
                            onClick={item.onRun}
                            className="gap-1.5 px-3"
                          >
                            <span className="shrink-0">{item.icon}</span>
                            <span className="flex-1 text-sm">{item.label}</span>
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

export default BacklogBulkToolbar;
