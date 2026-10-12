import useBulkSelectionStore from "@/store/bulk-selection";
import { BulkBar } from "./bulk-bar";

function BulkToolbar() {
  const { selectedTaskIds, clearSelection, selectAll } =
    useBulkSelectionStore();
  return (
    <BulkBar
      variant="board"
      selectedTaskIds={selectedTaskIds}
      clearSelection={clearSelection}
      selectAll={selectAll}
    />
  );
}

export default BulkToolbar;
