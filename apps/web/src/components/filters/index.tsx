import { Input } from "@/components/ui/input";
import { priorityColorsFilter } from "@/constants/priority-colors";
import useActiveWorkspaceUsers from "@/hooks/queries/workspace-users/use-active-workspace-users";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import * as Popover from "@radix-ui/react-popover";
import {
  Calendar,
  Filter,
  Flag,
  LayoutGrid,
  List,
  Search,
  User as UserIcon,
  X,
} from "lucide-react";
import { useState } from "react";

interface BoardFiltersProps {
  onFiltersChange: (filters: BoardFilters) => void;
}

export interface BoardFilters {
  search: string;
  assignee: string | null;
  priority: string | null;
  dueDate: string | null;
}

function BoardFilters({ onFiltersChange }: BoardFiltersProps) {
  const { project } = useProjectStore();
  const [searchValue, setSearchValue] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedDueDate, setSelectedDueDate] = useState<string | null>(null);
  const { viewMode, setViewMode } = useUserPreferencesStore();

  const { data: users } = useActiveWorkspaceUsers(project?.workspaceId ?? "");

  const handleSearch = (value: string) => {
    setSearchValue(value);
    onFiltersChange({
      search: value,
      assignee: selectedAssignee,
      priority: selectedPriority,
      dueDate: selectedDueDate,
    });
  };

  const handleAssigneeChange = (email: string | null) => {
    setSelectedAssignee(email);
    onFiltersChange({
      search: searchValue,
      assignee: email,
      priority: selectedPriority,
      dueDate: selectedDueDate,
    });
  };

  const handlePriorityChange = (priority: string) => {
    setSelectedPriority(priority);
    onFiltersChange({
      search: searchValue,
      assignee: selectedAssignee,
      priority,
      dueDate: selectedDueDate,
    });
  };

  const handleDueDateChange = (option: string) => {
    setSelectedDueDate(option);
    onFiltersChange({
      search: searchValue,
      assignee: selectedAssignee,
      priority: selectedPriority,
      dueDate: option,
    });
  };

  const handleClearFilters = () => {
    setSearchValue("");
    setSelectedAssignee(null);
    setSelectedPriority(null);
    setSelectedDueDate(null);
    onFiltersChange({
      search: "",
      assignee: null,
      priority: null,
      dueDate: null,
    });
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-1.5 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <Input
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search tasks..."
              className="h-7 pl-7 pr-2 text-xs bg-transparent w-full"
            />
          </div>

          <Popover.Root>
            <Popover.Trigger>
              <button
                type="button"
                className={cn(
                  "h-7 px-2 flex items-center gap-1.5 rounded-md text-xs transition-colors shrink-0",
                  selectedPriority || selectedAssignee || selectedDueDate
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700",
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="w-56 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 py-2 z-50"
                align="end"
                sideOffset={4}
              >
                <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Priority
                </div>
                {["urgent", "high", "medium", "low"].map((priority) => (
                  <button
                    type="button"
                    key={priority}
                    onClick={() => handlePriorityChange(priority)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors",
                      selectedPriority === priority
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    )}
                  >
                    <Flag
                      className={cn(
                        "w-3.5 h-3.5",
                        priorityColorsFilter[
                          priority as keyof typeof priorityColorsFilter
                        ],
                      )}
                    />
                    <span className="capitalize">{priority}</span>
                  </button>
                ))}

                <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2" />

                <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Assignee
                </div>
                <button
                  type="button"
                  onClick={() => handleAssigneeChange(null)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors",
                    selectedAssignee === null && searchValue === ""
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  )}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Unassigned</span>
                </button>
                {users?.map((user) => (
                  <button
                    type="button"
                    key={user?.user?.email}
                    onClick={() =>
                      handleAssigneeChange(user?.user?.email ?? null)
                    }
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors",
                      selectedAssignee === user?.user?.email
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    )}
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>{user?.user?.name}</span>
                  </button>
                ))}

                <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2" />

                <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Due Date
                </div>
                {["No due date", "Due this week", "Due next week"].map(
                  (option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => handleDueDateChange(option)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left transition-colors",
                        selectedDueDate === option
                          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                      )}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{option}</span>
                    </button>
                  ),
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-md p-0.5 flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md transition-colors",
              viewMode === "board"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="text-xs">Board</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md transition-colors",
              viewMode === "list"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
            )}
          >
            <List className="w-3.5 h-3.5" />
            <span className="text-xs">List</span>
          </button>
        </div>
      </div>

      {(selectedPriority ||
        selectedAssignee ||
        selectedDueDate ||
        searchValue) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {searchValue && (
            <button
              type="button"
              onClick={() => handleSearch("")}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 h-6 text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <Search className="w-3 h-3" />
              <span>{searchValue}</span>
              <X className="w-3 h-3 ml-1 text-zinc-400" />
            </button>
          )}
          {selectedPriority && (
            <button
              type="button"
              onClick={() => handlePriorityChange("")}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 h-6 text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <Flag
                className={cn(
                  "w-3 h-3",
                  priorityColorsFilter[
                    selectedPriority as keyof typeof priorityColorsFilter
                  ],
                )}
              />
              <span className="capitalize">{selectedPriority}</span>
              <X className="w-3 h-3 ml-1 text-zinc-400" />
            </button>
          )}
          {selectedAssignee && (
            <button
              type="button"
              onClick={() => handleAssigneeChange(null)}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 h-6 text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <UserIcon className="w-3 h-3" />
              <span>
                {users?.find((u) => u.user?.email === selectedAssignee)?.user
                  ?.name || "Unassigned"}
              </span>
              <X className="w-3 h-3 ml-1 text-zinc-400" />
            </button>
          )}
          {selectedDueDate && (
            <button
              type="button"
              onClick={() => handleDueDateChange("")}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 h-6 text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <Calendar className="w-3 h-3" />
              <span>{selectedDueDate}</span>
              <X className="w-3 h-3 ml-1 text-zinc-400" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClearFilters}
            className="flex items-center gap-1 px-1.5 py-1 text-xs rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Clear all</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default BoardFilters;
