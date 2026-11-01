import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/lib/format";
import type { AutomationRunTrigger } from "@/types/agent-automation";
import { AUTOMATION_EVENT_ICONS } from "./automation-icons";

type AutomationRunEventProps = {
  workspaceId: string;
  event: AutomationRunTrigger["events"][number];
};

const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

// Event text is untrusted workspace content and renders as plain text.
export function AutomationRunEvent({
  workspaceId,
  event,
}: AutomationRunEventProps) {
  const { t } = useTranslation();
  const Icon = AUTOMATION_EVENT_ICONS[event.event];
  const details = [
    event.actorName,
    event.columnName
      ? t("agent:automations.filters.columnIs", { name: event.columnName })
      : null,
  ].filter(Boolean);
  const pr = event.pullRequest;

  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="font-medium text-foreground text-sm">
            {t(`agent:automations.events.${event.event}`)}
          </span>
          <time
            dateTime={event.occurredAt}
            className="shrink-0 text-muted-foreground text-xs"
          >
            {formatDateTime(event.occurredAt)}
          </time>
        </span>
        {details.length > 0 && (
          <span className="truncate text-muted-foreground text-xs">
            {details.join(" · ")}
          </span>
        )}
        {pr &&
          (isWebUrl(pr.url) ? (
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-foreground text-xs hover:underline"
            >
              #{pr.number} {pr.title}
            </a>
          ) : (
            <span className="truncate text-foreground text-xs">
              #{pr.number} {pr.title}
            </span>
          ))}
        {event.commentPreview && (
          <p className="line-clamp-2 break-words text-muted-foreground text-xs">
            {event.commentPreview}
          </p>
        )}
      </div>
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
        params={{
          workspaceId,
          projectId: event.projectId,
          taskId: event.taskId,
        }}
        className="shrink-0 text-muted-foreground text-xs hover:text-foreground hover:underline"
      >
        {t("agent:automations.runs.openTask")}
      </Link>
    </li>
  );
}
