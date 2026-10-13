import { useNavigate } from "@tanstack/react-router";
import { LinkIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isInsidePopup } from "@/components/bulk-selection/use-bulk-selection-keys";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { toast } from "@/lib/toast";
import { focusTaskElement } from "./focus-task-element";
import {
  type FocusDirection,
  findTaskGroup,
  type MoveDirection,
  moveTarget,
  stepFocus,
  type TaskGroup,
  type TaskLayout,
} from "./task-groups";
import type { TaskSelectionStore } from "./task-selection";

type TaskViewShortcutsOptions = {
  layout: TaskLayout;
  selection: TaskSelectionStore;
  getGroups: () => TaskGroup[];
  project: { id: string; workspaceId: string } | null | undefined;
  enabled?: boolean;
  canMove?: boolean;
  onMove?: (taskId: string, overId: string) => void;
  onToggleGroup?: (groupId: string) => void;
  onToggleAllGroups?: () => void;
};

const peekedTaskId = () =>
  new URLSearchParams(window.location.search).get("taskId");

export function useTaskViewShortcuts({
  layout,
  selection,
  getGroups,
  project,
  enabled = true,
  canMove = false,
  onMove,
  onToggleGroup,
  onToggleAllGroups,
}: TaskViewShortcutsOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const focused = () => selection.getState().focusedTaskId;

  const focus = (taskId: string | null) => {
    if (!taskId) return;
    selection.getState().setFocusedTask(taskId);
    const peeked = peekedTaskId();
    if (peeked && peeked !== taskId) {
      navigate({ to: ".", search: { taskId }, replace: true });
    }
    focusTaskElement(taskId, !peeked);
  };

  const step = (direction: FocusDirection) =>
    focus(
      stepFocus(getGroups(), layout, focused() ?? peekedTaskId(), direction),
    );

  const move = (direction: MoveDirection) => {
    const taskId = focused();
    if (!taskId || !onMove) return;
    const overId = moveTarget(getGroups(), layout, taskId, direction);
    if (!overId) return;
    onMove(taskId, overId);
    requestAnimationFrame(() => focusTaskElement(taskId, !peekedTaskId()));
  };

  const withFocusedGroup = (run: (group: TaskGroup) => void) => {
    const found = findTaskGroup(getGroups(), focused());
    if (found) run(found.group);
  };

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (isInsidePopup(event.target) || peekedTaskId()) return;
      const state = selection.getState();
      if (!state.focusedTaskId || state.selectedTaskIds.size > 0) return;
      event.preventDefault();
      state.setFocusedTask(null);
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        activeElement.closest("[data-task-id]")
      ) {
        activeElement.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, selection]);

  const active = { enabled };
  const board = { enabled: enabled && layout === "board" };
  const movable = { enabled: enabled && canMove && Boolean(onMove) };
  const boardMovable = { enabled: movable.enabled && layout === "board" };
  const grouped = { enabled: enabled && Boolean(onToggleGroup) };

  useShortcut("nextTask", () => step("down"), active);
  useShortcut("previousTask", () => step("up"), active);
  useShortcut("focusRight", () => step("right"), board);
  useShortcut("focusLeft", () => step("left"), board);

  useShortcut(
    "peekTask",
    () => {
      const peeked = peekedTaskId();
      const taskId = focused() ?? peeked;
      if (!taskId) return;
      navigate({
        to: ".",
        search: peeked === taskId ? {} : { taskId },
        replace: Boolean(peeked),
      });
    },
    active,
  );

  useShortcut(
    "openFocusedTask",
    () => {
      const taskId = focused();
      if (!taskId || !project) return;
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
        params: {
          workspaceId: project.workspaceId,
          projectId: project.id,
          taskId,
        },
      });
    },
    { enabled: enabled && Boolean(project) },
  );

  useShortcut(
    "selectTask",
    () => {
      const taskId = focused();
      if (taskId) selection.getState().toggleSelection(taskId);
    },
    active,
  );
  useShortcut(
    "selectGroup",
    () =>
      withFocusedGroup((group) =>
        selection.getState().selectTasks(group.taskIds),
      ),
    active,
  );

  useShortcut(
    "copyPageUrl",
    async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.message(t("tasks:shortcuts.pageUrlCopied"), { icon: LinkIcon });
      } catch {
        toast.error(t("tasks:shortcuts.copyFailed"));
      }
    },
    active,
  );

  useShortcut("moveTaskTop", () => move("top"), movable);
  useShortcut("moveTaskUp", () => move("up"), movable);
  useShortcut("moveTaskDown", () => move("down"), movable);
  useShortcut("moveTaskBottom", () => move("bottom"), movable);
  useShortcut("moveTaskLeft", () => move("left"), boardMovable);
  useShortcut("moveTaskRight", () => move("right"), boardMovable);

  useShortcut(
    "toggleGroup",
    () => withFocusedGroup((group) => onToggleGroup?.(group.id)),
    grouped,
  );
  useShortcut("toggleAllGroups", () => onToggleAllGroups?.(), grouped);
}
