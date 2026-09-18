import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EllipsisIcon, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import CircularProgress from "@/components/ui/circular-progress";
import { Input } from "@/components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import type { TaskChecklist } from "@/fetchers/checklist";
import { cn } from "@/lib/cn";

export const listDragId = (id: string) => `list:${id}`;
export const dropZoneId = (id: string) => `drop:${id}`;

type DragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  label: string;
};

export function DragHandle({ attributes, listeners, label }: DragHandleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className="-ms-1 flex h-5 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-3.5" />
    </button>
  );
}

/** A draggable wrapper for one checklist item. */
export function SortableItem({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-60")}
    >
      {children(
        disabled ? null : (
          <DragHandle
            attributes={attributes}
            listeners={listeners}
            label={t("tasks:subtasks.dragItem")}
          />
        ),
      )}
    </div>
  );
}

type Props = {
  checklist: TaskChecklist;
  itemIds: string[];
  completed: number;
  canEdit: boolean;
  canAddItems: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddItem: (title: string) => Promise<boolean>;
  children: ReactNode;
};

export default function ChecklistBlock({
  checklist,
  itemIds,
  completed,
  canEdit,
  canAddItems,
  onRename,
  onDelete,
  onAddItem,
  children,
}: Props) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const name = checklist.title ?? t("tasks:subtasks.defaultName");
  const total = itemIds.length;

  const sortable = useSortable({
    id: listDragId(checklist.id),
    disabled: !canEdit,
  });
  // Lets an item be dropped into a checklist that has none yet.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropZoneId(checklist.id),
    disabled: !canEdit,
  });

  const saveName = () => {
    if (renaming === null) return;
    if (renaming.trim() !== (checklist.title ?? "")) onRename(renaming);
    setRenaming(null);
  };

  const addItem = async () => {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    const ok = await onAddItem(newTitle.trim());
    setSaving(false);
    if (ok) setNewTitle("");
  };

  return (
    <section
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      }}
      aria-label={name}
      className={cn(
        "rounded-lg",
        sortable.isDragging && "z-10 bg-background opacity-70 shadow-lg",
      )}
    >
      <div className="group flex h-8 items-center gap-1.5 ps-2 pe-1">
        {canEdit && (
          <DragHandle
            attributes={sortable.attributes}
            listeners={sortable.listeners}
            label={t("tasks:subtasks.dragChecklist")}
          />
        )}
        {renaming !== null ? (
          <Input
            size="sm"
            autoFocus
            value={renaming}
            maxLength={120}
            aria-label={t("tasks:subtasks.checklistName")}
            placeholder={t("tasks:subtasks.defaultName")}
            onChange={(e) => setRenaming(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") setRenaming(null);
            }}
          />
        ) : (
          <button
            type="button"
            disabled={!canEdit}
            onDoubleClick={() => setRenaming(checklist.title ?? "")}
            className="min-w-0 truncate text-left font-medium text-sm disabled:cursor-default"
            title={canEdit ? t("tasks:subtasks.renameHint") : undefined}
          >
            {name}
          </button>
        )}
        {total > 0 && renaming === null && (
          <span className="flex shrink-0 items-center gap-1.5">
            <CircularProgress completed={completed} total={total} />
            <span className="text-muted-foreground text-xs tabular-nums">
              {completed}/{total}
            </span>
          </span>
        )}
        <span className="flex-1" />
        {canEdit && renaming === null && (
          <Menu>
            <MenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                  aria-label={t("tasks:subtasks.checklistOptions", { name })}
                />
              }
            >
              <EllipsisIcon className="size-3.5" />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem onClick={() => setRenaming(checklist.title ?? "")}>
                <Pencil className="size-4" />
                {t("tasks:subtasks.rename")}
              </MenuItem>
              <MenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" />
                {t("tasks:subtasks.deleteChecklist")}
              </MenuItem>
            </MenuPopup>
          </Menu>
        )}
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setDropRef}
          className={cn(
            "flex min-h-1 flex-col rounded-md transition-colors",
            total === 0 && canEdit && "min-h-8",
            isOver && total === 0 && "bg-accent/40",
          )}
        >
          {children}
        </div>
      </SortableContext>

      {canAddItems &&
        (adding ? (
          <div className="mt-1 flex items-center gap-2 ps-2">
            <Input
              size="sm"
              autoFocus
              placeholder={t("tasks:subtasks.inputPlaceholder")}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addItem();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewTitle("");
                }
              }}
            />
            <Button
              size="xs"
              onClick={() => void addItem()}
              disabled={!newTitle.trim() || saving}
            >
              {t("tasks:subtasks.addAction")}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setAdding(false);
                setNewTitle("");
              }}
            >
              {t("common:actions.cancel")}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-0.5 flex h-7 items-center gap-1.5 rounded-md px-2 text-muted-foreground text-xs transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            {t("tasks:subtasks.addItem")}
          </button>
        ))}
    </section>
  );
}
