import { CheckCircle2, Circle, GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import columnIcons, {
  DEFAULT_COLUMN_ICON_NAMES,
} from "@/constants/column-icons";
import { useCreateColumn } from "@/hooks/mutations/column/use-create-column";
import { useDeleteColumn } from "@/hooks/mutations/column/use-delete-column";
import { useReorderColumns } from "@/hooks/mutations/column/use-reorder-columns";
import { useUpdateColumn } from "@/hooks/mutations/column/use-update-column";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ColumnEditorProps = {
  projectId: string;
};

export default function ColumnEditor({ projectId }: ColumnEditorProps) {
  const { t } = useTranslation();
  const { data: columns, isLoading } = useGetColumns(projectId);
  const { mutateAsync: createColumn, isPending: isCreating } =
    useCreateColumn();
  const { mutateAsync: updateColumn, isPending: isUpdating } =
    useUpdateColumn();
  const { mutateAsync: deleteColumn, isPending: isDeleting } =
    useDeleteColumn();
  const { mutateAsync: reorderColumns, isPending: isReordering } =
    useReorderColumns();
  const { canManageProjects } = useWorkspacePermission();
  const canEdit = canManageProjects();
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnIcon, setNewColumnIcon] = useState("Circle");
  const [iconPickerColumnId, setIconPickerColumnId] = useState<string | null>(
    null,
  );
  const [newIconPickerOpen, setNewIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [draftColumns, setDraftColumns] = useState<typeof columns>();
  const dragRef = useRef<{
    id: string;
    hoveredId: string | null;
    original: NonNullable<typeof columns>;
    columns: NonNullable<typeof columns>;
  } | null>(null);
  const savingRef = useRef(false);
  const isBusy = isCreating || isUpdating || isDeleting || isReordering;
  const canChange = canEdit && !isBusy && !draftColumns;
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      dragPreviewRef.current?.remove();
    };
  }, []);

  const handleCreate = async () => {
    if (!canChange || !newColumnName.trim()) return;
    try {
      await createColumn({
        projectId,
        data: { name: newColumnName.trim(), icon: newColumnIcon },
      });
      setNewColumnName("");
      setNewColumnIcon("Circle");
      toast.success(t("settings:columnEditor.toastCreated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:columnEditor.toastCreateError"),
      );
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await updateColumn({ id, projectId, data: { name } });
      toast.success(t("settings:columnEditor.toastRenamed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:columnEditor.toastRenameError"),
      );
    }
  };

  const handleToggleFinal = async (id: string, isFinal: boolean) => {
    try {
      await updateColumn({ id, projectId, data: { isFinal } });
      toast.success(
        isFinal
          ? t("settings:columnEditor.toastFinalOn")
          : t("settings:columnEditor.toastFinalOff"),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:columnEditor.toastUpdateError"),
      );
    }
  };

  const handleUpdateIcon = async (id: string, icon: string) => {
    try {
      await updateColumn({ id, projectId, data: { icon } });
      setIconPickerColumnId(null);
      setIconSearch("");
      toast.success(t("settings:columnEditor.toastIconUpdated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:columnEditor.toastUpdateError"),
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteColumn({ id, projectId });
      toast.success(t("settings:columnEditor.toastDeleted"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:columnEditor.toastDeleteError"),
      );
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    if (!canChange || savingRef.current || !columns) {
      e.preventDefault();
      return;
    }
    dragRef.current = {
      id,
      hoveredId: null,
      original: columns,
      columns: [...columns],
    };
    setDraftColumns(dragRef.current.columns);

    dragPreviewRef.current?.remove();

    const sourceElement = e.currentTarget;
    const sourceRect = sourceElement.getBoundingClientRect();

    // Use an isolated clone so the drag image only captures the selected row.
    const dragPreview = sourceElement.cloneNode(true) as HTMLDivElement;

    dragPreview.setAttribute("aria-hidden", "true");
    dragPreview.inert = true;

    Object.assign(dragPreview.style, {
      position: "fixed",
      top: "-10000px",
      left: "-10000px",
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
      margin: "0",
      boxSizing: "border-box",
      overflow: "hidden",
      pointerEvents: "none",
      transform: "none",
      contain: "layout paint",
    });

    document.body.appendChild(dragPreview);
    dragPreviewRef.current = dragPreview;

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.setDragImage(
      dragPreview,
      e.clientX - sourceRect.left,
      e.clientY - sourceRect.top,
    );
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    const drag = dragRef.current;
    if (!drag || savingRef.current) return;
    e.preventDefault();
    if (targetId === drag.id || targetId === drag.hoveredId) return;
    const sourceIndex = drag.columns.findIndex((col) => col.id === drag.id);
    const targetIndex = drag.columns.findIndex((col) => col.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
      return;
    drag.hoveredId = targetId;
    const reordered = [...drag.columns];
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, removed);
    drag.columns = reordered.map((col, position) => ({ ...col, position }));
    setDraftColumns(drag.columns);
  };

  const handleDragEnd = () => {
    dragRef.current = null;
    if (!savingRef.current) setDraftColumns(undefined);
    dragPreviewRef.current?.remove();
    dragPreviewRef.current = null;
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!dragRef.current || savingRef.current) return;
    e.preventDefault();
    const drag = dragRef.current;
    if (
      drag.columns.every((col, index) => col.id === drag.original[index]?.id)
    ) {
      handleDragEnd();
      return;
    }
    savingRef.current = true;
    handleDragEnd();
    try {
      await reorderColumns({
        projectId,
        columns: drag.columns.map((col, position) => ({
          id: col.id,
          position,
        })),
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:columnEditor.toastUpdateError"),
      );
    } finally {
      savingRef.current = false;
      setDraftColumns(undefined);
    }
  };

  const filteredIcons = Object.entries(columnIcons).filter(([iconName]) =>
    iconName.toLowerCase().includes(iconSearch.trim().toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings:columnEditor.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {(draftColumns ?? columns)?.map((col) => (
          // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- false positive for role="listitem"
          <div
            key={col.id}
            role="listitem"
            draggable={canChange}
            onDragStart={(e) => handleDragStart(e, col.id)}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className="flex flex-wrap items-center gap-2 p-2 border border-border rounded-md bg-sidebar hover:bg-sidebar-accent/50 transition-colors"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
            <Popover
              open={iconPickerColumnId === col.id}
              onOpenChange={(open) => {
                setIconPickerColumnId(open ? col.id : null);
                if (!open) setIconSearch("");
              }}
              modal={true}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  title={t("settings:columnEditor.pickIconTitle")}
                  disabled={!canChange}
                >
                  {getColumnIcon(col.slug, col.isFinal, col.icon)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-2">
                  <Input
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder={t(
                      "settings:columnEditor.searchIconsPlaceholder",
                    )}
                    className="h-8 text-base sm:text-xs"
                  />
                  <div className="max-h-[280px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-6 gap-1.5">
                      {filteredIcons.map(([iconName, Icon]) => {
                        const selectedIconName =
                          col.icon ||
                          DEFAULT_COLUMN_ICON_NAMES[
                            col.slug as keyof typeof DEFAULT_COLUMN_ICON_NAMES
                          ];
                        const isSelected = selectedIconName === iconName;
                        return (
                          <Button
                            key={iconName}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateIcon(col.id, iconName)}
                            className={cn(
                              "h-10 items-center justify-center rounded-md p-0",
                              isSelected &&
                                "bg-sidebar-accent text-sidebar-accent-foreground",
                            )}
                            title={iconName}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Input
              defaultValue={col.name}
              aria-label={t("settings:columnEditor.renameAria", {
                name: col.name,
              })}
              className="h-8 min-w-0 flex-1 basis-40 text-base sm:text-sm"
              disabled={!canChange}
              onBlur={(e) => {
                if (e.target.value !== col.name) {
                  handleRename(col.id, e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <div
                className="flex items-center gap-2"
                title={t("settings:columnEditor.doneColumnTooltip")}
              >
                {col.isFinal ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("settings:columnEditor.doneColumn")}
                </span>
                <Switch
                  checked={col.isFinal}
                  onCheckedChange={
                    canEdit
                      ? (checked) => handleToggleFinal(col.id, checked)
                      : undefined
                  }
                  disabled={!canChange}
                  aria-label={t("settings:columnEditor.markDoneAria", {
                    name: col.name,
                  })}
                  className="scale-75"
                />
                <span className="text-[11px] text-muted-foreground w-8">
                  {col.isFinal
                    ? t("settings:columnEditor.on")
                    : t("settings:columnEditor.off")}
                </span>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={t("settings:columnEditor.deleteAria", {
                    name: col.name,
                  })}
                  onClick={() => handleDelete(col.id)}
                  disabled={!canChange}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Popover
            open={newIconPickerOpen}
            onOpenChange={(open) => {
              setNewIconPickerOpen(open);
              if (!open) setIconSearch("");
            }}
            modal={true}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                title={t("settings:columnEditor.pickIconTitle")}
                disabled={!canChange}
              >
                {getColumnIcon("", false, newColumnIcon)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-2">
                <Input
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder={t(
                    "settings:columnEditor.searchIconsPlaceholder",
                  )}
                  className="h-8 text-base sm:text-xs"
                />
                <div className="max-h-[280px] overflow-y-auto pr-1">
                  <div className="grid grid-cols-6 gap-1.5">
                    {filteredIcons.map(([iconName, Icon]) => {
                      const isSelected = newColumnIcon === iconName;
                      return (
                        <Button
                          key={iconName}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewColumnIcon(iconName);
                            setNewIconPickerOpen(false);
                            setIconSearch("");
                          }}
                          className={cn(
                            "h-10 items-center justify-center rounded-md p-0",
                            isSelected &&
                              "bg-sidebar-accent text-sidebar-accent-foreground",
                          )}
                          title={iconName}
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Input
            placeholder={t("settings:columnEditor.newColumnPlaceholder")}
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            className="h-8 text-base sm:text-sm flex-1"
            disabled={!canChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreate}
            disabled={!canChange || !newColumnName.trim()}
            className="h-8 gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("settings:columnEditor.add")}
          </Button>
        </div>
      )}
    </div>
  );
}
