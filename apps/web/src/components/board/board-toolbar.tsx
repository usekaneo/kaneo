import { Filter, PanelsTopLeft, Rows3, X } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import labelColors from "@/constants/label-colors";
import type { BoardFilters } from "@/hooks/use-task-filters";
import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import type { ProjectWithTasks } from "@/types/project";

type WorkspaceLabel = {
  id: string;
  name: string;
  color: string;
};

type ActiveUsers = {
  members?: Array<{
    userId: string;
    user?: {
      image?: string | null;
      name?: string | null;
    } | null;
  }>;
};

type BoardToolbarProps = {
  project?: ProjectWithTasks | null;
  filters: BoardFilters;
  updateFilter: (
    key: keyof BoardFilters,
    value: BoardFilters[keyof BoardFilters],
  ) => void;
  updateLabelFilter: (labelId: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  users?: ActiveUsers;
  workspaceLabels: WorkspaceLabel[];
  viewMode: "board" | "list";
  setViewMode: (mode: "board" | "list") => void;
};

function CheckSlot({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background"
      }`}
    >
      {checked ? "✓" : null}
    </span>
  );
}

type ActiveFilterChipProps = {
  subject: string;
  operator: string;
  value: ReactNode;
  onClear: () => void;
};

function ActiveFilterChip({
  subject,
  operator,
  value,
  onClear,
}: ActiveFilterChipProps) {
  return (
    <div className="inline-flex h-7 items-center rounded-md border border-border bg-background text-xs shadow-xs">
      <span className="px-2 font-medium text-foreground">{subject}</span>
      <span className="h-full w-px bg-border" />
      <span className="px-2 text-foreground/80">{operator}</span>
      <span className="h-full w-px bg-border" />
      <span className="flex px-2 text-foreground">{value}</span>
      <span className="h-full w-px bg-border" />
      <button
        className="inline-flex h-full w-7 items-center justify-center rounded-r-md text-foreground/70 hover:bg-accent/70 hover:text-foreground"
        onClick={onClear}
        type="button"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StackedIcons({
  items,
  itemClassName,
}: {
  items: Array<{ id: string; node: ReactNode }>;
  itemClassName?: string;
}) {
  if (items.length === 0) return null;

  return (
    <span className="inline-flex items-center -space-x-1.5">
      {items.slice(0, 3).map((item) => (
        <span
          key={item.id}
          className={`inline-flex size-4 items-center justify-center rounded-full bg-background ${itemClassName ?? ""}`}
        >
          {item.node}
        </span>
      ))}
    </span>
  );
}

export default function BoardToolbar({
  project,
  filters,
  updateFilter,
  updateLabelFilter,
  clearFilters,
  hasActiveFilters,
  users,
  workspaceLabels,
  viewMode,
  setViewMode,
}: BoardToolbarProps) {
  const selectedStatusIds = filters.status ?? [];
  const selectedPriorityIds = filters.priority ?? [];
  const selectedAssigneeIds = filters.assignee ?? [];
  const selectedDueDateFilters = filters.dueDate ?? [];

  const getStatusDisplayName = (statusId: string) => {
    const column = project?.columns?.find((col) => col.id === statusId);
    return column?.name || statusId;
  };
  const getStatusIcon = (statusId: string) => {
    const column = project?.columns?.find((col) => col.id === statusId);
    return getColumnIcon(statusId, column?.isFinal);
  };

  const getPriorityDisplayName = (priority: string) =>
    priority.charAt(0).toUpperCase() + priority.slice(1);

  const getAssigneeDisplayName = (userId: string) => {
    const member = users?.members?.find((m) => m.userId === userId);
    return member?.user?.name || "Unknown";
  };
  const getAssigneeAvatar = (userId: string) => {
    const member = users?.members?.find((m) => m.userId === userId);
    return (
      <Avatar className="h-4 w-4">
        <AvatarImage
          src={member?.user?.image ?? ""}
          alt={member?.user?.name || ""}
        />
        <AvatarFallback className="border border-border/30 text-[9px] font-medium">
          {member?.user?.name?.charAt(0).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
    );
  };

  const uniqueLabels = workspaceLabels.reduce(
    (acc: WorkspaceLabel[], label: WorkspaceLabel) => {
      const existing = acc.find(
        (l) => l.name === label.name && l.color === label.color,
      );
      if (!existing) acc.push(label);
      return acc;
    },
    [],
  );

  const isLabelGroupSelected = (label: { name: string; color: string }) => {
    return workspaceLabels
      .filter((l) => l.name === label.name && l.color === label.color)
      .some((l) => filters.labels?.includes(l.id));
  };

  const toggleStatusFilter = (statusId: string) => {
    const exists = selectedStatusIds.includes(statusId);
    const next = exists
      ? selectedStatusIds.filter((id) => id !== statusId)
      : [...selectedStatusIds, statusId];
    updateFilter("status", next.length > 0 ? next : null);
  };

  const togglePriorityFilter = (priority: string) => {
    const exists = selectedPriorityIds.includes(priority);
    const next = exists
      ? selectedPriorityIds.filter((id) => id !== priority)
      : [...selectedPriorityIds, priority];
    updateFilter("priority", next.length > 0 ? next : null);
  };

  const toggleAssigneeFilter = (userId: string) => {
    const exists = selectedAssigneeIds.includes(userId);
    const next = exists
      ? selectedAssigneeIds.filter((id) => id !== userId)
      : [...selectedAssigneeIds, userId];
    updateFilter("assignee", next.length > 0 ? next : null);
  };

  const toggleDueDateFilter = (dueDate: string) => {
    const exists = selectedDueDateFilters.includes(dueDate);
    const next = exists
      ? selectedDueDateFilters.filter((id) => id !== dueDate)
      : [...selectedDueDateFilters, dueDate];
    updateFilter("dueDate", next.length > 0 ? next : null);
  };

  const toggleLabelGroup = (label: { name: string; color: string }) => {
    const matching = workspaceLabels.filter(
      (l) => l.name === label.name && l.color === label.color,
    );
    const anySelected = matching.some((l) => filters.labels?.includes(l.id));

    for (const l of matching) {
      if (
        (anySelected && filters.labels?.includes(l.id)) ||
        (!anySelected && !filters.labels?.includes(l.id))
      ) {
        updateLabelFilter(l.id);
      }
    }
  };

  const clearLabelFilters = () => {
    if (!filters.labels || filters.labels.length === 0) return;
    for (const labelId of filters.labels) updateLabelFilter(labelId);
  };

  return (
    <div className="border-border/80 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="flex min-h-10 items-center px-2 py-1.5 md:px-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-foreground text-xs font-medium outline-none ring-0 hover:bg-accent/60"
                  />
                }
              >
                <Filter className="h-3 w-3" />
                Filter
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                    Filter By
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    Status
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-72">
                    <div className="grid grid-cols-1 gap-1 p-1">
                      <button
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                          selectedStatusIds.length === 0
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilter("status", null)}
                        type="button"
                      >
                        <CheckSlot checked={selectedStatusIds.length === 0} />
                        All statuses
                      </button>
                      {project?.columns?.map((column) => (
                        <button
                          key={column.id}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                            selectedStatusIds.includes(column.id)
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                          }`}
                          onClick={() => toggleStatusFilter(column.id)}
                          type="button"
                        >
                          <CheckSlot
                            checked={selectedStatusIds.includes(column.id)}
                          />
                          <span className="inline-flex h-4 w-4 items-center justify-center">
                            {getStatusIcon(column.id)}
                          </span>
                          <span className="truncate">{column.name}</span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    Priority
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-72">
                    <div className="grid grid-cols-1 gap-1 p-1">
                      <button
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                          selectedPriorityIds.length === 0
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilter("priority", null)}
                        type="button"
                      >
                        <CheckSlot checked={selectedPriorityIds.length === 0} />
                        All priorities
                      </button>
                      {["urgent", "high", "medium", "low"].map((priority) => (
                        <button
                          key={priority}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                            selectedPriorityIds.includes(priority)
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                          }`}
                          onClick={() => togglePriorityFilter(priority)}
                          type="button"
                        >
                          <CheckSlot
                            checked={selectedPriorityIds.includes(priority)}
                          />
                          <span className="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
                            {getPriorityIcon(priority)}
                          </span>
                          <span className="truncate capitalize">
                            {priority}
                          </span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    Assignee
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    <div className="grid grid-cols-1 gap-1 p-1">
                      <button
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                          selectedAssigneeIds.length === 0
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilter("assignee", null)}
                        type="button"
                      >
                        <CheckSlot checked={selectedAssigneeIds.length === 0} />
                        All assignees
                      </button>
                      {users?.members?.map((member) => (
                        <button
                          key={member.userId}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                            selectedAssigneeIds.includes(member.userId)
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                          }`}
                          onClick={() => toggleAssigneeFilter(member.userId)}
                          type="button"
                        >
                          <CheckSlot
                            checked={selectedAssigneeIds.includes(
                              member.userId,
                            )}
                          />
                          <span className="inline-flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={member.user?.image ?? ""}
                                alt={member.user?.name || ""}
                              />
                              <AvatarFallback className="border border-border/30 text-[10px] font-medium">
                                {member.user?.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.user?.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    Due date
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    <div className="grid grid-cols-1 gap-1 p-1">
                      <button
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                          selectedDueDateFilters.length === 0
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilter("dueDate", null)}
                        type="button"
                      >
                        <CheckSlot
                          checked={selectedDueDateFilters.length === 0}
                        />
                        All due dates
                      </button>
                      {["Due this week", "Due next week", "No due date"].map(
                        (dueDate) => (
                          <button
                            key={dueDate}
                            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                              selectedDueDateFilters.includes(dueDate)
                                ? "bg-accent text-accent-foreground"
                                : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                            }`}
                            onClick={() => toggleDueDateFilter(dueDate)}
                            type="button"
                          >
                            <CheckSlot
                              checked={selectedDueDateFilters.includes(dueDate)}
                            />
                            {dueDate}
                          </button>
                        ),
                      )}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                    Labels
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64">
                    <DropdownMenuItem
                      onClick={clearLabelFilters}
                      className="h-8 rounded-md text-sm"
                    >
                      <CheckSlot
                        checked={!filters.labels || filters.labels.length === 0}
                      />
                      All labels
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {uniqueLabels.length > 0 ? (
                      uniqueLabels.map((label) => (
                        <DropdownMenuItem
                          key={label.id}
                          onClick={() => toggleLabelGroup(label)}
                          className="h-8 rounded-md text-sm"
                        >
                          <CheckSlot checked={isLabelGroupSelected(label)} />
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                labelColors.find((c) => c.value === label.color)
                                  ?.color || "var(--color-neutral-400)",
                            }}
                          />
                          <span className="flex-1">{label.name}</span>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem
                        disabled
                        className="h-8 rounded-md text-sm text-muted-foreground"
                      >
                        No labels available
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={clearFilters}
                      className="h-8 rounded-md text-sm text-muted-foreground"
                    >
                      Clear all filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedStatusIds.length > 0 && (
              <ActiveFilterChip
                subject="Status"
                operator="is any of"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StackedIcons
                      items={selectedStatusIds.map((statusId) => ({
                        id: statusId,
                        node: getStatusIcon(statusId),
                      }))}
                      itemClassName="[&>svg]:h-3.5 [&>svg]:w-3.5"
                    />
                    <span>
                      {selectedStatusIds.length === 1
                        ? getStatusDisplayName(selectedStatusIds[0])
                        : `${selectedStatusIds.length} selected`}
                    </span>
                  </span>
                }
                onClear={() => updateFilter("status", null)}
              />
            )}

            {selectedPriorityIds.length > 0 && (
              <ActiveFilterChip
                subject="Priority"
                operator="is any of"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StackedIcons
                      items={selectedPriorityIds.map((priority) => ({
                        id: priority,
                        node: getPriorityIcon(priority),
                      }))}
                    />
                    <span>
                      {selectedPriorityIds.length === 1
                        ? getPriorityDisplayName(selectedPriorityIds[0])
                        : `${selectedPriorityIds.length} selected`}
                    </span>
                  </span>
                }
                onClear={() => updateFilter("priority", null)}
              />
            )}

            {selectedAssigneeIds.length > 0 && (
              <ActiveFilterChip
                subject="Assignee"
                operator="is any of"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StackedIcons
                      items={selectedAssigneeIds.map((userId) => ({
                        id: userId,
                        node: getAssigneeAvatar(userId),
                      }))}
                    />
                    <span>
                      {selectedAssigneeIds.length === 1
                        ? getAssigneeDisplayName(selectedAssigneeIds[0])
                        : `${selectedAssigneeIds.length} selected`}
                    </span>
                  </span>
                }
                onClear={() => updateFilter("assignee", null)}
              />
            )}

            {selectedDueDateFilters.length > 0 && (
              <ActiveFilterChip
                subject="Due date"
                operator="is any of"
                value={
                  selectedDueDateFilters.length === 1
                    ? selectedDueDateFilters[0]
                    : `${selectedDueDateFilters.length} selected`
                }
                onClear={() => updateFilter("dueDate", null)}
              />
            )}

            {filters.labels && filters.labels.length > 0 && (
              <ActiveFilterChip
                subject="Labels"
                operator="include any of"
                value={`${filters.labels.length} selected`}
                onClear={clearLabelFilters}
              />
            )}
          </div>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
                viewMode === "board"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
              onClick={() => setViewMode("board")}
            >
              <PanelsTopLeft className="h-3 w-3" />
              Board
            </button>
            <button
              type="button"
              className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
              onClick={() => setViewMode("list")}
            >
              <Rows3 className="h-3 w-3" />
              List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
