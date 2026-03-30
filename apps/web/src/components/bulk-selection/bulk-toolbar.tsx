import {
  Archive,
  ArrowDownToLine,
  CalendarIcon,
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
import { useTranslation } from "react-i18next";
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
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import { Button } from "../ui/button";
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "../ui/toolbar";

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
  const { t } = useTranslation();
  const { selectedTaskIds, clearSelection, selectAll } =
    useBulkSelectionStore();

  const priorityOptions = useMemo(
    () => [
      { value: "urgent", label: getPriorityLabel("urgent") },
      { value: "high", label: getPriorityLabel("high") },
      { value: "medium", label: getPriorityLabel("medium") },
      { value: "low", label: getPriorityLabel("low") },
      { value: "no-priority", label: getPriorityLabel("no-priority") },
    ],
    [],
  );
  const { project } = useProjectStore();
  const {
    bulkMoveToBacklog,
    bulkDelete,
    bulkArchive,
    bulkChangeStatus,
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

  const handleMoveToBacklog = useCallback(async () => {
    try {
      await bulkMoveToBacklog(Array.from(selectedTaskIds));
      toast.success(
        t("tasks:bulk.moveToBacklogSuccess", { count: selectedCount }),
      );
      clearSelection();
    } catch (_error) {
      toast.error(t("tasks:bulk.moveToBacklogError"));
    }
  }, [bulkMoveToBacklog, selectedTaskIds, selectedCount, clearSelection, t]);

  const handleBulkDelete = useCallback(async () => {
    if (!confirm(t("tasks:bulk.deleteConfirm", { count: selectedCount }))) {
      return;
    }

    try {
      await bulkDelete(Array.from(selectedTaskIds));
      toast.success(t("tasks:bulk.deleteSuccess", { count: selectedCount }));
      clearSelection();
      setIsActionsOpen(false);
    } catch (_error) {
      toast.error(t("tasks:bulk.deleteError"));
    }
  }, [bulkDelete, selectedTaskIds, selectedCount, clearSelection, t]);

  const handleBulkArchive = useCallback(async () => {
    try {
      await bulkArchive(Array.from(selectedTaskIds));
      toast.success(t("tasks:bulk.archiveSuccess", { count: selectedCount }));
      clearSelection();
      setIsActionsOpen(false);
    } catch (_error) {
      toast.error(t("tasks:bulk.archiveError"));
    }
  }, [bulkArchive, selectedTaskIds, selectedCount, clearSelection, t]);

  const handleBulkChangeStatus = useCallback(
    async (status: string) => {
      try {
        await bulkChangeStatus({
          taskIds: Array.from(selectedTaskIds),
          status,
        });
        toast.success(t("tasks:bulk.updateSuccess", { count: selectedCount }));
        clearSelection();
        setIsActionsOpen(false);
      } catch (_error) {
        toast.error(t("tasks:bulk.updateError"));
      }
    },
    [bulkChangeStatus, selectedTaskIds, selectedCount, clearSelection, t],
  );

  const handleBulkAssign = useCallback(
    async (userId: string) => {
      try {
        await bulkAssign({ taskIds: Array.from(selectedTaskIds), userId });
        toast.success(t("tasks:bulk.assignSuccess", { count: selectedCount }));
        clearSelection();
        setIsActionsOpen(false);
      } catch (_error) {
        toast.error(t("tasks:bulk.assignError"));
      }
    },
    [bulkAssign, selectedTaskIds, selectedCount, clearSelection, t],
  );

  const handleBulkPriority = useCallback(
    async (priority: string) => {
      try {
        await bulkPriority({
          taskIds: Array.from(selectedTaskIds),
          priority,
        });
        toast.success(t("tasks:bulk.updateSuccess", { count: selectedCount }));
        clearSelection();
        setIsActionsOpen(false);
      } catch (_error) {
        toast.error(t("tasks:bulk.updatePriorityError"));
      }
    },
    [bulkPriority, selectedTaskIds, selectedCount, clearSelection, t],
  );

  const handleBulkAddLabel = useCallback(
    async (labelId: string) => {
      try {
        await bulkAddLabel({
          taskIds: Array.from(selectedTaskIds),
          labelId,
        });
        toast.success(
          t("tasks:bulk.addLabelSuccess", { count: selectedCount }),
        );
        clearSelection();
        setIsActionsOpen(false);
      } catch (_error) {
        toast.error(t("tasks:bulk.addLabelError"));
      }
    },
    [bulkAddLabel, selectedTaskIds, selectedCount, clearSelection, t],
  );

  const handleBulkDueDate = useCallback(
    async (date: Date | undefined) => {
      try {
        await bulkDueDate({
          taskIds: Array.from(selectedTaskIds),
          dueDate: date?.toISOString() ?? null,
        });
        toast.success(t("tasks:bulk.updateSuccess", { count: selectedCount }));
        clearSelection();
        setIsDatePickerOpen(false);
      } catch (_error) {
        toast.error(t("tasks:bulk.updateDueDateError"));
      }
    },
    [bulkDueDate, selectedTaskIds, selectedCount, clearSelection, t],
  );

  const groupedItems = useMemo<BulkActionGroup[]>(
    () => [
      {
        value: "actions",
        label: t("tasks:bulk.actions"),
        items: [
          {
            value: "bulk-delete",
            label: t("tasks:bulk.delete"),
            icon: <Trash2 className="h-4 w-4 text-muted-foreground" />,
            onRun: () => {
              void handleBulkDelete();
            },
          },
          {
            value: "bulk-archive",
            label: t("tasks:bulk.archive"),
            icon: <Archive className="h-4 w-4 text-muted-foreground" />,
            onRun: () => {
              void handleBulkArchive();
            },
          },
        ],
      },
      {
        value: "status",
        label: t("tasks:bulk.changeStatus"),
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
        label: t("tasks:bulk.assignTo"),
        items: (workspaceUsers?.members ?? []).map((member) => ({
          value: `assign-${member.userId}`,
          label: member.user?.name || t("common:people.someone"),
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
        label: t("tasks:bulk.setPriority"),
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
        label: t("tasks:bulk.addLabel"),
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
      project?.columns,
      workspaceUsers?.members,
      uniqueLabels,
      handleBulkDelete,
      handleBulkArchive,
      handleBulkChangeStatus,
      handleBulkAssign,
      handleBulkPriority,
      handleBulkAddLabel,
      priorityOptions,
      t,
    ],
  );

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <Toolbar className="items-center gap-1 rounded-xl border-border/80 bg-background px-1.5 py-1 shadow-lg/8">
        <ToolbarGroup className="px-1.5">
          <span className="text-sm font-medium text-foreground">
            {t("tasks:bulk.selectedCount", { count: selectedCount })}
          </span>
        </ToolbarGroup>

        <ToolbarSeparator orientation="vertical" className="my-1 h-5" />

        <ToolbarGroup>
          <Button size="sm" variant="ghost" onClick={handleMoveToBacklog}>
            <ArrowDownToLine className="size-4" />
            {t("tasks:bulk.moveToBacklog")}
          </Button>
        </ToolbarGroup>

        <ToolbarSeparator orientation="vertical" className="my-1 h-5" />

        <ToolbarGroup>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost">
                <CalendarIcon className="size-4" />
                {t("tasks:bulk.setDueDate")}
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
                  {t("tasks:dueDate.clear")}
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
            {t("tasks:bulk.actions")}
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
            <CommandInput placeholder={t("tasks:bulk.searchActions")} />
            <CommandPanel>
              <CommandEmpty>{t("tasks:bulk.noActionsFound")}</CommandEmpty>
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

export default BulkToolbar;
