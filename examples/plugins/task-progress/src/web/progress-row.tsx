import type { PluginTask } from "@kaneo/plugin-sdk/web";
import { ProgressBar } from "./progress-bar.js";

export function ProgressRow({
  task,
  value,
  onOpen,
}: {
  task: PluginTask;
  value: number;
  onOpen: (taskId: string) => void;
}) {
  return (
    <button type="button" className="ktp-row" onClick={() => onOpen(task.id)}>
      <span className="ktp-row-title">
        {task.number === null ? null : (
          <span className="ktp-muted">#{task.number}</span>
        )}
        <span className="ktp-truncate">{task.title}</span>
      </span>
      <ProgressBar value={value} label={task.title} />
      <span className="ktp-row-value">{value}%</span>
    </button>
  );
}
