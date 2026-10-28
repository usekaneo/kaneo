import useBacklogBulkSelectionStore from "@/store/backlog-bulk-selection";
import { useTaskActionShortcuts } from "@/components/project/task-view-keys/use-task-action-shortcuts";
import { BulkBar } from "./bulk-bar";

function BacklogBulkToolbar() {
  const { selectedTaskIds, clearSelection, selectAll } =
    useBacklogBulkSelectionStore();
  useTaskActionShortcuts(useBacklogBulkSelectionStore);
  return (
    <BulkBar
      variant="backlog"
      selectedTaskIds={selectedTaskIds}
      clearSelection={clearSelection}
      selectAll={selectAll}
      getFocusedTaskId={() =>
        useBacklogBulkSelectionStore.getState().focusedTaskId
      }
    />
  );
}

export default BacklogBulkToolbar;
