import { ArrowDownToLine, X } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useBulkOperations } from "@/hooks/mutations/task/use-bulk-operations";
import useBulkSelectionStore from "@/store/bulk-selection";
import { Button } from "../ui/button";
import BulkActionsMenu from "./bulk-actions-menu";

function BulkToolbar() {
  const { selectedTaskIds, clearSelection, selectAll } =
    useBulkSelectionStore();
  const { bulkMoveToBacklog } = useBulkOperations();

  const selectedCount = selectedTaskIds.size;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
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

  const handleMoveToBacklog = async () => {
    if (
      !confirm(
        `Move ${selectedCount} tasks to backlog? This will change their status to "planned".`,
      )
    ) {
      return;
    }

    try {
      await bulkMoveToBacklog(Array.from(selectedTaskIds));
      toast.success(`${selectedCount} tasks moved to backlog`);
      clearSelection();
    } catch (_error) {
      toast.error("Failed to move tasks to backlog");
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">
          {selectedCount} selected
        </span>
        <hr className="w-px h-6 bg-border" />

        <Button onClick={handleMoveToBacklog} size="sm" variant="outline">
          <ArrowDownToLine className="size-3" />
          Move to Backlog
        </Button>

        <div className="flex-1 gap-2">
          <BulkActionsMenu />

          <Button
            variant="ghost"
            className="ml-2"
            onClick={clearSelection}
            size="sm"
          >
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {selectedCount === 0 && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground/70 bg-background/90 backdrop-blur-sm border border-border/40 rounded-md px-3 py-2 shadow-md max-w-sm">
          Hold Cmd/Ctrl + Click to select tasks • Cmd/Ctrl + A to select all
        </div>
      )}
    </div>
  );
}

export default BulkToolbar;
