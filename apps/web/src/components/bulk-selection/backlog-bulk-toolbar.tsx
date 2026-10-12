import useBacklogBulkSelectionStore from "@/store/backlog-bulk-selection";
import { BulkBar } from "./bulk-bar";

function BacklogBulkToolbar() {
  const { selectedTaskIds, clearSelection, selectAll } =
    useBacklogBulkSelectionStore();
  return (
    <BulkBar
      variant="backlog"
      selectedTaskIds={selectedTaskIds}
      clearSelection={clearSelection}
      selectAll={selectAll}
    />
  );
}

export default BacklogBulkToolbar;
