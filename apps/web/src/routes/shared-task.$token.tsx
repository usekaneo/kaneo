import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  CalendarClock,
  Clock3,
  ExternalLink,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { KaneoBranding } from "@/components/public-project/kaneo-branding";
import { MarkdownRenderer } from "@/components/public-project/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import {
  useGetSharedTask,
  useGetSharedTaskDescription,
} from "@/hooks/queries/task/use-get-shared-task";
import { getColumnIcon } from "@/lib/column";
import { formatDateMedium, formatDateTime } from "@/lib/format";
import { getPriorityLabel, getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";

export const Route = createFileRoute("/shared-task/$token")({
  component: SharedTaskPage,
});

function SharedTaskPage() {
  const { token } = Route.useParams();
  const { t } = useTranslation();
  const taskQuery = useGetSharedTask(token);
  const task = taskQuery.data;
  const descriptionQuery = useGetSharedTaskDescription(
    token,
    task?.descriptionDeferred ?? false,
  );
  const description = task?.descriptionDeferred
    ? descriptionQuery.data
    : task?.description;

  if (taskQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <PageTitle title={t("sharedTask:pageTitle")} />
        <main
          className="mx-auto max-w-4xl animate-pulse space-y-5"
          aria-busy="true"
        >
          <div className="h-5 w-28 rounded bg-muted" />
          <div className="h-10 w-3/4 rounded bg-muted" />
          <div className="h-32 rounded-xl border border-border bg-muted/40" />
          <div className="h-64 rounded-xl border border-border bg-muted/40" />
        </main>
      </div>
    );
  }

  if (taskQuery.isError || !task) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <PageTitle title={t("sharedTask:error.title")} />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/12">
              <ExternalLink className="h-10 w-10 text-destructive-foreground" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-foreground">
                {t("sharedTask:error.title")}
              </h1>
              <p className="mx-auto max-w-md text-muted-foreground">
                {t("sharedTask:error.description")}
              </p>
            </div>
            <KaneoBranding />
          </div>
        </main>
      </div>
    );
  }

  const statusLabel = getStatusDisplayLabel(
    task.status.slug,
    task.status.name ?? undefined,
  );
  const priorityLabel = getPriorityLabel(task.priority);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageTitle title={`${task.ticketKey}: ${task.title}`} />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-mono text-sm font-semibold text-muted-foreground">
              {task.ticketKey}
            </span>
            <Badge variant="secondary">{t("sharedTask:badge")}</Badge>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("sharedTask:readOnly")}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
        <section className="space-y-4" aria-labelledby="shared-task-title">
          <h1
            id="shared-task-title"
            className="text-balance text-3xl font-semibold leading-tight sm:text-4xl"
          >
            {task.title}
          </h1>

          <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3">
              {getColumnIcon(
                task.status.slug,
                task.status.isFinal,
                task.status.icon,
              )}
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("sharedTask:fields.status")}
                </dt>
                <dd className="font-medium">{statusLabel}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getPriorityIcon(task.priority)}
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("sharedTask:fields.priority")}
                </dt>
                <dd className="font-medium">{priorityLabel}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserRound className="size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("sharedTask:fields.assignee")}
                </dt>
                <dd className="font-medium">
                  {task.assigneeName ?? t("sharedTask:fields.unassigned")}
                </dd>
              </div>
            </div>
            {task.startDate && (
              <div className="flex items-center gap-3">
                <Calendar className="size-4 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t("sharedTask:fields.startDate")}
                  </dt>
                  <dd className="font-medium">
                    {formatDateMedium(task.startDate)}
                  </dd>
                </div>
              </div>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-3">
                <CalendarClock className="size-4 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t("sharedTask:fields.dueDate")}
                  </dt>
                  <dd className="font-medium">
                    {formatDateMedium(task.dueDate)}
                  </dd>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Clock3 className="size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("sharedTask:fields.updated")}
                </dt>
                <dd className="font-medium">
                  {formatDateTime(task.updatedAt)}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock3 className="size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("sharedTask:fields.created")}
                </dt>
                <dd className="font-medium">
                  {formatDateTime(task.createdAt)}
                </dd>
              </div>
            </div>
          </dl>
        </section>

        <section
          className="rounded-xl border border-border bg-card p-5 sm:p-6"
          aria-labelledby="shared-task-description"
        >
          <h2
            id="shared-task-description"
            className="mb-4 text-sm font-semibold text-muted-foreground"
          >
            {t("sharedTask:fields.description")}
          </h2>
          {descriptionQuery.isLoading && (
            <p className="text-sm text-muted-foreground" role="status">
              {t("sharedTask:descriptionLoading")}
            </p>
          )}
          {descriptionQuery.isError && (
            <p className="text-sm text-destructive" role="alert">
              {t("sharedTask:descriptionError")}
            </p>
          )}
          {!descriptionQuery.isLoading &&
            !descriptionQuery.isError &&
            (description ? (
              <MarkdownRenderer content={description} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("sharedTask:noDescription")}
              </p>
            ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6">
          <KaneoBranding />
          <span>{t("sharedTask:readOnly")}</span>
        </div>
      </footer>
    </div>
  );
}
