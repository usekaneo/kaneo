import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { TaskTreeNode } from "@/types/task";
import TaskRow from "./task-row";

type TaskTreeListProps = {
  tasks: TaskTreeNode[];
  projectSlug: string;
  isExpanded: (taskId: string) => boolean;
  onToggleExpand: (taskId: string) => void;
};

export default function TaskTreeList({
  tasks,
  projectSlug,
  isExpanded,
  onToggleExpand,
}: TaskTreeListProps) {
  const { t } = useTranslation();

  if (tasks.length === 0) {
    return (
      <div className="py-12 px-4 text-center text-sm text-muted-foreground">
        {t("tasks:listView.noTasks")}
      </div>
    );
  }

  return (
    <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
      <AnimatePresence initial={false} mode="popLayout">
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
          >
            <TaskRow
              task={task}
              projectSlug={projectSlug}
              depth={task.depth}
              hasChildren={task.hasChildren}
              isExpanded={isExpanded(task.id)}
              onToggleExpand={() => onToggleExpand(task.id)}
              parentTitle={task.parentTitle}
              parentId={task.parentId}
              showStatusIcon
              hierarchyMode="tree"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </SortableContext>
  );
}
