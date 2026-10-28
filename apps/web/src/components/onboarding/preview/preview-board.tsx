import { Circle, CircleCheck, CircleDot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PreviewColumn } from "./preview-column";
import { PreviewSkeletonColumn } from "./preview-skeleton-column";
import { PreviewTaskCard } from "./preview-task-card";

export type PreviewTask = { id: string; ticket: string; title: string };

type PreviewBoardProps = {
  tasks: PreviewTask[] | null;
};

export function PreviewBoard({ tasks }: PreviewBoardProps) {
  const { t } = useTranslation();

  if (!tasks) {
    return (
      <div className="flex flex-1 gap-3 p-4" aria-hidden="true">
        <PreviewSkeletonColumn cards={2} />
        <PreviewSkeletonColumn cards={1} />
        <PreviewSkeletonColumn cards={0} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-3 p-4">
      <PreviewColumn
        icon={<Circle className="size-3.5" />}
        name={t("tasks:status.to-do")}
        count={tasks.length}
      >
        {tasks.map((task, order) => (
          <PreviewTaskCard
            key={task.id}
            ticket={task.ticket}
            title={task.title}
            order={order}
          />
        ))}
      </PreviewColumn>
      <PreviewColumn
        icon={<CircleDot className="size-3.5" />}
        name={t("tasks:status.in-progress")}
        count={0}
      />
      <PreviewColumn
        icon={<CircleCheck className="size-3.5" />}
        name={t("tasks:status.done")}
        count={0}
      />
    </div>
  );
}
