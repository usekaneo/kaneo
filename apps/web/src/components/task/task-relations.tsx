import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import useDeleteTaskRelation from "@/hooks/mutations/task-relation/use-delete-task-relation";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";

type TaskRelationsProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
};

const relationTypeLabels: Record<string, string> = {
  blocks: "Blocks",
  related: "Related to",
};

export default function TaskRelations({
  taskId,
  projectId,
  workspaceId,
}: TaskRelationsProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRelationType, setSelectedRelationType] = useState<
    "blocks" | "related"
  >("related");

  const { data: relations = [] } = useGetTaskRelations(taskId);
  const { data: projectData } = useGetTasks(projectId);
  const createRelation = useCreateTaskRelation();
  const deleteRelation = useDeleteTaskRelation(taskId);

  const nonSubtaskRelations = relations.filter(
    (rel) => rel.relationType !== "subtask",
  );

  const groupedRelations = useMemo(() => {
    const groups: Record<
      string,
      Array<{
        id: string;
        relationType: string;
        task: NonNullable<(typeof nonSubtaskRelations)[number]["sourceTask"]>;
        direction: "source" | "target";
      }>
    > = {};

    for (const rel of nonSubtaskRelations) {
      const isSource = rel.sourceTaskId === taskId;
      const linkedTask = isSource ? rel.targetTask : rel.sourceTask;
      if (!linkedTask) continue;

      const type = rel.relationType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push({
        id: rel.id,
        relationType: type,
        task: linkedTask,
        direction: isSource ? "source" : "target",
      });
    }

    return groups;
  }, [nonSubtaskRelations, taskId]);

  const existingRelatedTaskIds = new Set(
    nonSubtaskRelations.flatMap((rel) => [rel.sourceTaskId, rel.targetTaskId]),
  );
  existingRelatedTaskIds.add(taskId);

  const allTasks = useMemo(() => {
    if (!projectData) return [];
    const tasks: Array<{
      id: string;
      title: string;
      number: number | null;
      status: string;
    }> = [];

    if ("columns" in projectData && Array.isArray(projectData.columns)) {
      for (const col of projectData.columns as Array<{
        tasks: Array<{
          id: string;
          title: string;
          number: number | null;
          status: string;
        }>;
      }>) {
        if (col.tasks) {
          for (const t of col.tasks) {
            tasks.push(t);
          }
        }
      }
    }

    return tasks;
  }, [projectData]);

  const filteredTasks = allTasks.filter(
    (t) =>
      !existingRelatedTaskIds.has(t.id) &&
      t.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleLinkTask = async (targetTaskId: string) => {
    try {
      await createRelation.mutateAsync({
        sourceTaskId: taskId,
        targetTaskId,
        relationType: selectedRelationType,
      });
      setDialogOpen(false);
      setSearchQuery("");
    } catch {
      toast.error("Failed to link task");
    }
  };

  const handleRemoveRelation = (relationId: string) => {
    deleteRelation.mutate(relationId);
  };

  const handleNavigateToTask = (linkedTaskId: string) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId, projectId, taskId: linkedTaskId },
    });
  };

  const hasRelations = nonSubtaskRelations.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1 px-0 h-8 hover:bg-transparent"
          >
            {isOpen ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
            <Link2 className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Relations</span>
            {hasRelations && (
              <span className="text-xs text-muted-foreground ml-1">
                {nonSubtaskRelations.length}
              </span>
            )}
          </Button>
        </CollapsibleTrigger>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="xs" className="text-muted-foreground">
              <Plus className="size-3.5" />
            </Button>
          </DialogTrigger>
          <DialogPopup className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link task</DialogTitle>
              <DialogDescription>
                Search for a task in this project to create a relation.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-4 flex flex-col gap-3">
              <div className="flex gap-2">
                <Button
                  variant={
                    selectedRelationType === "related" ? "default" : "outline"
                  }
                  size="xs"
                  onClick={() => setSelectedRelationType("related")}
                >
                  Related
                </Button>
                <Button
                  variant={
                    selectedRelationType === "blocks" ? "default" : "outline"
                  }
                  size="xs"
                  onClick={() => setSelectedRelationType("blocks")}
                >
                  Blocks
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  size="sm"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="pl-8"
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto flex flex-col gap-0.5">
                {filteredTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No tasks found
                  </p>
                )}
                {filteredTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-accent/50 transition-colors text-left w-full"
                    onClick={() => handleLinkTask(t.id)}
                  >
                    {getColumnIcon(t.status, false)}
                    <span className="text-sm truncate flex-1 text-foreground/90">
                      {t.title}
                    </span>
                    {t.number != null && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        #{t.number}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter variant="bare">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      </div>

      <CollapsibleContent>
        {Object.entries(groupedRelations).map(([type, items]) => (
          <div key={type} className="mt-2">
            <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
              {relationTypeLabels[type] || type}
            </p>
            <div className="flex flex-col gap-0.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    onClick={() => handleNavigateToTask(item.task.id)}
                  >
                    {getColumnIcon(item.task.status, false)}
                    <span className="text-sm truncate flex-1 text-foreground/90">
                      {item.task.title}
                    </span>
                    {item.task.number != null && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        #{item.task.number}
                      </span>
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground h-5 w-5 p-0"
                    onClick={() => handleRemoveRelation(item.id)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!hasRelations && (
          <p className="text-xs text-muted-foreground px-2 py-1">
            No related tasks
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
