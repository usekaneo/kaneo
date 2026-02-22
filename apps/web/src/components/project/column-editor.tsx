import { CheckCircle2, Circle, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCreateColumn } from "@/hooks/mutations/column/use-create-column";
import { useDeleteColumn } from "@/hooks/mutations/column/use-delete-column";
import { useReorderColumns } from "@/hooks/mutations/column/use-reorder-columns";
import { useUpdateColumn } from "@/hooks/mutations/column/use-update-column";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { toast } from "@/lib/toast";

type ColumnEditorProps = {
  projectId: string;
};

export default function ColumnEditor({ projectId }: ColumnEditorProps) {
  const { data: columns, isLoading } = useGetColumns(projectId);
  const { mutateAsync: createColumn } = useCreateColumn();
  const { mutateAsync: updateColumn } = useUpdateColumn();
  const { mutateAsync: deleteColumn } = useDeleteColumn();
  const { mutateAsync: reorderColumns } = useReorderColumns();
  const [newColumnName, setNewColumnName] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!newColumnName.trim()) return;
    try {
      await createColumn({
        projectId,
        data: { name: newColumnName.trim() },
      });
      setNewColumnName("");
      toast.success("Column created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create column",
      );
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await updateColumn({ id, projectId, data: { name } });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update column",
      );
    }
  };

  const handleToggleFinal = async (id: string, isFinal: boolean) => {
    try {
      await updateColumn({ id, projectId, data: { isFinal } });
      toast.success(
        isFinal ? "Column marked as final" : "Column unmarked as final",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update column",
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteColumn({ id, projectId });
      toast.success("Column deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete column",
      );
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || !columns) return;

    const reordered = [...columns];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, removed);

    const updates = reordered.map((col, i) => ({ id: col.id, position: i }));
    reorderColumns({ projectId, columns: updates });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading columns...</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {columns?.map((col, index) => (
          // biome-ignore lint/a11y/useSemanticElements: false positive for role="listitem"
          <div
            key={col.id}
            role="listitem"
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className="flex items-center gap-2 p-2 border border-border rounded-md bg-sidebar hover:bg-sidebar-accent/50 transition-colors"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
            <Input
              defaultValue={col.name}
              className="h-8 text-sm flex-1"
              onBlur={(e) => {
                if (e.target.value !== col.name) {
                  handleRename(col.id, e.target.value);
                }
              }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="flex items-center gap-2"
                title="Treat this as a done column"
              >
                {col.isFinal ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Done column
                </span>
                <Switch
                  checked={col.isFinal}
                  onCheckedChange={(checked) =>
                    handleToggleFinal(col.id, checked)
                  }
                  aria-label={`Mark ${col.name} as done column`}
                  className="scale-75"
                />
                <span className="text-[11px] text-muted-foreground w-8">
                  {col.isFinal ? "On" : "Off"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(col.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="New column name..."
          value={newColumnName}
          onChange={(e) => setNewColumnName(e.target.value)}
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={!newColumnName.trim()}
          className="h-8 gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}
