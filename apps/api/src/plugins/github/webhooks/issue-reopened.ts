import { withIntegrationLink } from "../services/with-integration-link";
import { linkedTaskScope } from "../services/integration-task-scope";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../services/link-manager";
import {
  findAllIntegrationsByRepo,
  updateTaskStatus,
} from "../services/task-service";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import { resolveTargetStatus } from "../utils/resolve-column";

type IssueReopenedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    html_url: string;
    state: string;
  };
  installation?: { id: number };
  repository: {
    id: number;
    owner: { login: string };
    name: string;
    full_name: string;
  };
};

export async function handleIssueReopened(payload: IssueReopenedPayload) {
  const { issue } = payload;

  const integrations = await findAllIntegrationsByRepo(payload);

  for (const integration of integrations) {
    const externalLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "issue"),
        eq(externalLinkTable.externalId, issue.number.toString()),
      ),
    });

    if (!externalLink) {
      continue;
    }

    await withIntegrationLink(
      externalLink,
      integration,
      async (db, afterCommit, externalLink) => {
        const task = await db.query.taskTable.findFirst({
          where: linkedTaskScope(externalLink.taskId, integration.projectId),
        });

        if (!task) {
          return;
        }

        const existingMetadata = parseLinkMetadata(externalLink.metadata, {
          externalLinkId: externalLink.id,
          source: "issue_reopened",
        });

        if (
          existingMetadata.createdFrom === "kaneo" ||
          existingMetadata.state === "open"
        ) {
          return;
        }

        const targetStatus = await resolveTargetStatus(
          task.projectId,
          "issue_reopened",
          "to-do",
          db,
        );

        const statusResult = await updateTaskStatus(task.id, targetStatus, db);
        if (
          statusResult.applied &&
          statusResult.before.status !== statusResult.after.status
        ) {
          afterCommit(() =>
            publishEvent("task.status_changed", {
              taskId: statusResult.after.id,
              projectId: statusResult.after.projectId,
              userId: null,
              oldStatus: statusResult.before.status,
              newStatus: statusResult.after.status,
              title: statusResult.after.title,
              assigneeId: statusResult.after.userId,
              type: "status_changed",
            }),
          );
        }

        await updateExternalLink(
          externalLink.id,
          {
            metadata: {
              ...existingMetadata,
              state: "open",
            },
          },
          db,
        );
      },
    );
  }
}
