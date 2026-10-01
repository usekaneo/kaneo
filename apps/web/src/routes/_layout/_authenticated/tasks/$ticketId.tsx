import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import getTaskByTicketId from "@/fetchers/task/get-task-by-ticket-id";
import {
  HttpError,
  handleUnauthorized,
  isUnauthorizedError,
} from "@/lib/http-error";

function hasStatus(error: unknown, ...statuses: number[]) {
  return error instanceof HttpError && statuses.includes(error.status);
}

async function findTask(ticketId: string, activeWorkspaceId?: string | null) {
  if (activeWorkspaceId) {
    try {
      return await getTaskByTicketId(ticketId, activeWorkspaceId);
    } catch (error) {
      if (!hasStatus(error, 404)) throw error;
    }
  }
  return getTaskByTicketId(ticketId);
}

export const Route = createFileRoute("/_layout/_authenticated/tasks/$ticketId")(
  {
    loader: async ({ params, context }) => {
      let task: Awaited<ReturnType<typeof getTaskByTicketId>>;
      try {
        task = await findTask(
          params.ticketId,
          context.session?.session?.activeOrganizationId,
        );
      } catch (error) {
        if (isUnauthorizedError(error)) {
          handleUnauthorized();
          return;
        }
        if (hasStatus(error, 409)) return { failure: "ambiguous" as const };
        if (hasStatus(error, 400, 404)) {
          return { failure: "notFound" as const };
        }
        throw error;
      }

      throw redirect({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
        params: {
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
        },
        replace: true,
      });
    },
    component: RouteComponent,
  },
);

function RouteComponent() {
  const { t } = useTranslation();
  const { ticketId } = Route.useParams();
  const result = Route.useLoaderData();

  if (!result) return null;

  const isAmbiguous = result.failure === "ambiguous";
  const title = isAmbiguous
    ? t("tasks:common.ticketAmbiguous")
    : t("tasks:common.taskNotFound");

  return (
    <>
      <PageTitle title={title} />
      <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 bg-background px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground max-w-md">
          {isAmbiguous
            ? t("tasks:common.ticketAmbiguousDescription", { ticketId })
            : t("tasks:common.ticketNotFoundDescription", { ticketId })}
        </p>
        <Button variant="outline" render={<Link to="/dashboard" />}>
          {t("workspace:search.backToDashboard")}
        </Button>
      </div>
    </>
  );
}
