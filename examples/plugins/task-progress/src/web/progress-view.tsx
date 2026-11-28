import { Skeleton } from "@kaneo/plugin-sdk/ui";
import { useOpenTask, useT, useTasks } from "@kaneo/plugin-sdk/web";
import type { ProjectViewProps } from "@kaneo/plugin-sdk/web";
import { averageProgress } from "./average-progress.js";
import { ProgressBar } from "./progress-bar.js";
import { ProgressRow } from "./progress-row.js";
import { useProjectProgress } from "./use-project-progress.js";

export function ProgressView({ projectId }: ProjectViewProps) {
  const t = useT();
  const tasks = useTasks(projectId);
  const progress = useProjectProgress(projectId);
  const openTask = useOpenTask();

  if (tasks.isLoading || progress.isPending) {
    return (
      <div className="ktp-view">
        <Skeleton className="ktp-skeleton" />
      </div>
    );
  }

  if (tasks.error || progress.isError) {
    return <p className="ktp-view ktp-muted">{t("view.loadError")}</p>;
  }

  const list = tasks.data ?? [];
  if (list.length === 0) {
    return <p className="ktp-view ktp-muted">{t("view.empty")}</p>;
  }

  const valueOf = (taskId: string) => progress.data[taskId] ?? 0;
  const average = averageProgress(list.map((task) => valueOf(task.id)));

  return (
    <section className="ktp-view">
      <header className="ktp-summary">
        <span className="ktp-muted">{t("view.average")}</span>
        <span className="ktp-percent">{average}%</span>
        <ProgressBar value={average} label={t("view.average")} />
      </header>
      <ul className="ktp-list">
        {list.map((task) => (
          <li key={task.id}>
            <ProgressRow
              task={task}
              value={valueOf(task.id)}
              onOpen={openTask}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
