import useBulkSelectionStore from "@/store/bulk-selection";
import { useTaskActionShortcuts } from "@/components/project/task-view-keys/use-task-action-shortcuts";
import { BulkBar } from "./bulk-bar";

function BulkToolbar() {
  const { selectedTaskIds, clearSelection, selectAll } =
    useBulkSelectionStore();
  useTaskActionShortcuts(useBulkSelectionStore);
  return (
    <BulkBar
      variant="board"
      selectedTaskIds={selectedTaskIds}
      clearSelection={clearSelection}
      selectAll={selectAll}
      getFocusedTaskId={() => useBulkSelectionStore.getState().focusedTaskId}
    />
  );
}

export default BulkToolbar;
