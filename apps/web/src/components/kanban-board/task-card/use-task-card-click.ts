import { useNavigate } from "@tanstack/react-router";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import type { DragListeners } from "./drag-listeners";

export function useTaskCardClick(task: Task, dragListeners: DragListeners) {
  const { project } = useProjectStore();
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const toggleSelection = useBulkSelectionStore(
    (state) => state.toggleSelection,
  );
  const selectRange = useBulkSelectionStore((state) => state.selectRange);
  const setSelectionAnchor = useBulkSelectionStore(
    (state) => state.setSelectionAnchor,
  );

  function handleClick(
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (!project || !task || !workspace) return;

    if (e.shiftKey) {
      e.preventDefault();
      selectRange(task.id);
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleSelection(task.id);
      return;
    }

    setSelectionAnchor(task.id);
    const currentParams = new URLSearchParams(window.location.search);
    const currentTaskId = currentParams.get("taskId");

    if (currentTaskId === task.id) {
      navigate({
        to: ".",
        search: {},
      });
    } else {
      navigate({
        to: ".",
        search: { taskId: task.id },
      });
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.target !== e.currentTarget) return;
    if (e.key === "Enter") {
      handleClick(e);
      e.preventDefault();
    } else {
      if (e.key === "Escape") {
        toggleSelection(task.id);
      }
      dragListeners?.onKeyDown?.(e);
    }
  };

  return { handleClick, handleKeyDown };
}
