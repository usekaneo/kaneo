import { useNavigate } from "@tanstack/react-router";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { isOwnDomEvent } from "@/lib/is-own-dom-event";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";

export function useTaskCardClick(task: Task) {
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

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!project || !task || !workspace || !isOwnDomEvent(e)) return;

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
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      selectRange(task.id);
    }
  };

  return { handleClick, handleKeyDown };
}
