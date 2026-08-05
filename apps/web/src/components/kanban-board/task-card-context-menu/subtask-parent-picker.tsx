import { CornerDownRight, Search, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";

type SubtaskParentPickerProps = {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function SubtaskParentPicker({
  task,
  open,
  onOpenChange,
}: SubtaskParentPickerProps) {
  const { t } = useTranslation();
  const { project } = useProjectStore();
  const [search, setSearch] = useState("");
  const createRelation = useCreateTaskRelation();

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Pool of candidate parents: any task in the same project except the task
  // itself and its existing descendants (cycles would break the relation).
  const candidates = useMemo(() => {
    if (!project) return [];
    const descendantIds = new Set<string>([task.id]);
    const collectDescendants = (id: string) => {
      project.columns.forEach((col) => {
        col.tasks.forEach((t) => {
          if (t.parentTaskId === id) {
            descendantIds.add(t.id);
            collectDescendants(t.id);
          }
        });
      });
      project.archivedTasks.forEach((task) => {
        if (task.parentTaskId === id) {
          descendantIds.add(task.id);
          collectDescendants(task.id);
        }
      });
      project.plannedTasks.forEach((task) => {
        if (task.parentTaskId === id) {
          descendantIds.add(task.id);
          collectDescendants(task.id);
        }
      });
    };
    collectDescendants(task.id);

    const all: Task[] = [];
    project.columns.forEach((col) => {
      col.tasks.forEach((t) => {
        if (!descendantIds.has(t.id)) all.push(t);
      });
    });
    project.archivedTasks.forEach((t) => {
      if (!descendantIds.has(t.id)) all.push(t);
    });
    project.plannedTasks.forEach((t) => {
      if (!descendantIds.has(t.id)) all.push(t);
    });
    return all;
  }, [project, task.id]);

  // Only top-level tasks (no parent) are valid parents. This keeps the
  // picker simple and prevents nesting a child under another child.
  const validParents = candidates.filter((c) => !c.parentTaskId);

  const handlePick = async (parentId: string) => {
    try {
      await createRelation.mutateAsync({
        sourceTaskId: parentId,
        targetTaskId: task.id,
        relationType: "subtask",
      });
      toast.success(t("tasks:relations.subtask.linkSuccess"));
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:relations.subtask.linkError"),
      );
    }
  };

  const handleUnlink = () => {
    // ponytail: simplest path to "unlink parent" via the existing
    // useDeleteTaskRelation endpoint requires the relation id, which the
    // subtask API on get-tasks does not return. Until a bulk endpoint
    // exists, users remove parent relations from the task detail page.
    toast.error(t("tasks:relations.subtask.unlinkNotSupported"));
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandDialogPopup>
        <Command
          items={[
            {
              value: "parents",
              label: t("tasks:relations.subtask.pickParent"),
              items: validParents,
            },
          ]}
        >
          <CommandInput
            placeholder={t("tasks:relations.subtask.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <CommandPanel>
            <CommandEmpty>
              <div className="text-center py-6">
                <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("tasks:relations.noTasksFound")}
                </p>
              </div>
            </CommandEmpty>
            <CommandList>
              {(group) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.label}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: Task) => (
                        <CommandItem
                          key={item.id}
                          value={`${project?.slug ?? ""}-${item.number ?? ""} ${item.title}`}
                          onClick={() => handlePick(item.id)}
                          className="flex items-center gap-3 py-2"
                        >
                          <CornerDownRight className="size-3.5 text-muted-foreground" />
                          {getColumnIcon(item.status, false, undefined)}
                          <span className="text-xs text-muted-foreground shrink-0 font-mono">
                            {project?.slug}-{item.number}
                          </span>
                          <span className="text-sm truncate flex-1">
                            {item.title}
                          </span>
                          {item.subtasks && item.subtasks.length > 0 ? (
                            <span className="text-[10px] text-muted-foreground">
                              {t("tasks:relations.subtask.subtaskCount", {
                                count: item.subtasks.length,
                              })}
                            </span>
                          ) : null}
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                </Fragment>
              )}
            </CommandList>
          </CommandPanel>
        </Command>

        {task.parentTaskId ? (
          <div className="border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-destructive"
              onClick={handleUnlink}
            >
              <X className="size-3.5" />
              {t("tasks:relations.subtask.unlink")}
            </Button>
          </div>
        ) : null}
      </CommandDialogPopup>
    </CommandDialog>
  );
}
