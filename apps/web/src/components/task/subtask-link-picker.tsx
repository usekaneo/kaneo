import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@/components/ui/command";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toast } from "@/lib/toast";

type SubtaskLinkPickerProps = {
  taskId: string;
  workspaceId: string;
  direction: "parent" | "child";
  onClose: () => void;
};

export default function SubtaskLinkPicker({
  taskId,
  workspaceId,
  direction,
  onClose,
}: SubtaskLinkPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const search = useGlobalSearch({
    workspaceId,
    type: "tasks",
    q: debouncedQuery,
    limit: 50,
    subtaskOf: direction === "child" ? taskId : undefined,
    parentOf: direction === "parent" ? taskId : undefined,
  });
  const relations = useGetTaskRelations(taskId);
  const createRelation = useCreateTaskRelation();
  const excludedIds = new Set(
    (relations.data ?? [])
      .filter((relation) => relation.relationType === "subtask")
      .flatMap((relation) => [relation.sourceTaskId, relation.targetTaskId]),
  );
  excludedIds.add(taskId);
  const waiting = query.trim() !== debouncedQuery || search.isFetching;
  const failed = search.isError || relations.isError;
  const items =
    waiting || failed
      ? []
      : (search.data?.results ?? []).filter(
          (item) => item.type === "task" && !excludedIds.has(item.id),
        );

  const handleSelect = async (selectedId: string) => {
    if (createRelation.isPending) return;
    try {
      await createRelation.mutateAsync({
        sourceTaskId: direction === "parent" ? selectedId : taskId,
        targetTaskId: direction === "parent" ? taskId : selectedId,
        relationType: "subtask",
      });
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:subtasks.linkError"),
      );
    }
  };

  return (
    <CommandDialog open onOpenChange={(open) => !open && onClose()}>
      <CommandDialogPopup
        aria-label={
          direction === "parent"
            ? t("tasks:subtasks.chooseParent")
            : t("tasks:subtasks.addExisting")
        }
      >
        <Command items={items} filter={null}>
          <CommandInput
            placeholder={t("tasks:subtasks.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <CommandPanel>
            {failed ? (
              <p role="alert" className="p-4 text-sm text-destructive">
                {t("tasks:subtasks.searchError")}
              </p>
            ) : waiting || relations.isPending ? (
              <p role="status" className="p-4 text-sm text-muted-foreground">
                {t("tasks:subtasks.loading")}
              </p>
            ) : (
              <CommandEmpty>
                {debouncedQuery
                  ? t("tasks:relations.noTasksFound")
                  : t("tasks:subtasks.searchPrompt")}
              </CommandEmpty>
            )}
            <CommandList>
              {(item: (typeof items)[number]) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  disabled={createRelation.isPending || relations.isPending}
                  onClick={() => void handleSelect(item.id)}
                  className="flex items-center gap-3"
                >
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.projectSlug}-{item.taskNumber}
                  </span>
                  <span className="truncate">{item.title}</span>
                </CommandItem>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
