import { useTranslation } from "react-i18next";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

type AgentCodeJobEvent = {
  sequence: number;
  phase: string;
  createdAt: string;
};

const KNOWN_PHASES = new Set([
  "queued",
  "dispatched",
  "running",
  "committing",
  "completed",
  "failed",
  "cancelled",
]);

// The job's recorded state history, oldest first.
export function AgentCodeJobSteps({ events }: { events: AgentCodeJobEvent[] }) {
  const { t } = useTranslation();
  const steps = events.filter((event) => KNOWN_PHASES.has(event.phase));
  if (steps.length === 0) return null;

  return (
    <ol
      aria-label={t("agent:code.history")}
      className="ml-1.5 flex flex-col gap-1.5 border-border border-l pl-1.5"
    >
      {steps.map((event) => (
        <li
          key={event.sequence}
          className="flex items-baseline justify-between gap-2 pl-2 text-xs leading-4"
        >
          <span className="text-muted-foreground">
            {t(`agent:code.status.${event.phase}`)}
          </span>
          <time
            dateTime={event.createdAt}
            title={formatDateTime(event.createdAt)}
            className="shrink-0 text-muted-foreground/80"
          >
            {formatRelativeTime(event.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}
