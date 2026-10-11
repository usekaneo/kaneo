import { Button, Skeleton, Spinner } from "@kaneo/plugin-sdk/ui";
import { useT } from "@kaneo/plugin-sdk/web";
import type { TaskPanelProps } from "@kaneo/plugin-sdk/web";
import { useState } from "react";
import { ProgressBar } from "./progress-bar.js";
import { useSetTaskProgress, useTaskProgress } from "./use-task-progress.js";

const STEPS = [0, 25, 50, 75, 100];

export function ProgressPanel({ projectId, taskId }: TaskPanelProps) {
  const t = useT();
  const progress = useTaskProgress(projectId, taskId);
  const save = useSetTaskProgress(projectId, taskId);
  const [draft, setDraft] = useState<number | null>(null);

  if (progress.isPending) return <Skeleton className="ktp-skeleton" />;
  if (progress.isError) {
    return <p className="ktp-muted">{t("panel.loadError")}</p>;
  }

  const saved = progress.data;
  const value = draft ?? saved;

  const commit = (next: number) => {
    setDraft(null);
    if (next !== saved) save.mutate(next);
  };

  const commitDraft = () => {
    if (draft !== null) commit(draft);
  };

  return (
    <div className="ktp-panel">
      <div className="ktp-panel-header">
        <span className="ktp-percent">{value}%</span>
        {save.isPending ? <Spinner className="ktp-spinner" /> : null}
      </div>
      <ProgressBar value={value} label={t("panel.label")} />
      <input
        type="range"
        className="ktp-range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-label={t("panel.label")}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commitDraft}
        onKeyUp={commitDraft}
        onBlur={commitDraft}
      />
      <div className="ktp-steps">
        {STEPS.map((step) => (
          <Button
            key={step}
            type="button"
            size="xs"
            variant={step === value ? "default" : "outline"}
            aria-pressed={step === value}
            aria-label={t("panel.setTo", { value: step })}
            onClick={() => commit(step)}
          >
            {step}%
          </Button>
        ))}
      </div>
      {save.isError ? (
        <p className="ktp-error">{t("panel.saveError")}</p>
      ) : null}
    </div>
  );
}
