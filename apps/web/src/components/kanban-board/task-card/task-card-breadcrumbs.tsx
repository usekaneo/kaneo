import { ChevronRightIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { stopCardEvents } from "@/components/task-chips/stop-card-events";
import type Task from "@/types/task";

export function TaskCardBreadcrumbs({
  task,
  workspaceId,
  ticketId,
}: {
  task: Task;
  workspaceId: string;
  ticketId?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ancestors = task.ancestors ?? [];
  if (!ticketId && !ancestors.length) return null;
  return (
    <nav
      aria-label={t("tasks:board.ancestorBreadcrumbs")}
      className="min-w-0 flex-1 overflow-hidden"
    >
      <ol className="flex min-w-0 items-center gap-1 text-[11px] leading-3.5">
        {ticketId && <li className="shrink-0 font-mono">{ticketId}</li>}
        {ancestors.map((ancestor, index) => (
          <li key={ancestor.id} className="flex min-w-0 items-center gap-1">
            {(ticketId || index > 0) && (
              <ChevronRightIcon
                aria-hidden="true"
                className="size-3 shrink-0"
              />
            )}
            <button
              type="button"
              className="min-w-0 truncate rounded-sm text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              title={ancestor.title}
              disabled={!workspaceId}
              {...stopCardEvents}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (ancestor.projectId === task.projectId) {
                  void navigate({ to: ".", search: { taskId: ancestor.id } });
                } else {
                  void navigate({
                    to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                    params: {
                      workspaceId,
                      projectId: ancestor.projectId,
                      taskId: ancestor.id,
                    },
                  });
                }
              }}
            >
              {ancestor.title}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
