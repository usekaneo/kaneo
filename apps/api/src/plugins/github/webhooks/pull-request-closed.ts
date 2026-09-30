import { withIntegrationLink } from "../services/with-integration-link";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import type { GitHubConfig } from "../config";
import { updateExternalLink } from "../services/link-manager";
import {
  findAllIntegrationsByRepo,
  findTaskById,
  updateTaskStatus,
} from "../services/task-service";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import { resolveTargetStatus } from "../utils/resolve-column";

type PRClosedPayload = {
  action: string;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    state: string;
    merged: boolean;
    merged_at: string | null;
    head: {
      ref: string;
    };
  };
  installation?: { id: number };
  repository: {
    id: number;
    owner: { login: string };
    name: string;
  };
};

export async function handlePullRequestClosed(payload: PRClosedPayload) {
  const { pull_request } = payload;

  const integrations = await findAllIntegrationsByRepo(payload);

  for (const integration of integrations) {
    const config = JSON.parse(integration.config) as GitHubConfig;

    const externalLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "pull_request"),
        eq(externalLinkTable.externalId, pull_request.number.toString()),
      ),
    });

    if (!externalLink) {
      continue;
    }

    await withIntegrationLink(
      externalLink,
      integration,
      async (database, afterCommit, lockedLink) => {
        const task = await findTaskById(externalLink.taskId, database);

        if (!task) {
          return;
        }

        const existingMetadata = parseLinkMetadata(lockedLink.metadata, {
          externalLinkId: externalLink.id,
          source: "pull_request_closed",
        });

        await updateExternalLink(
          externalLink.id,
          {
            metadata: {
              ...existingMetadata,
              state: "closed",
              merged: pull_request.merged,
              mergedAt: pull_request.merged_at,
            },
          },
          database,
        );

        afterCommit(() =>
          publishEvent("task.updated", {
            projectId: integration.projectId,
            taskId: task.id,
          }),
        );

        if (pull_request.merged) {
          const allTaskPRs = await database.query.externalLinkTable.findMany({
            where: and(
              eq(externalLinkTable.taskId, task.id),
              eq(externalLinkTable.resourceType, "pull_request"),
            ),
          });

          const hasOpenPRs = allTaskPRs.some((pr) => {
            if (pr.id === externalLink.id) return false;
            const metadata = parseLinkMetadata(pr.metadata, {
              externalLinkId: pr.id,
              source: "pull_request_closed",
            });
            return metadata.state === "open";
          });

          if (!hasOpenPRs) {
            const targetStatus = await resolveTargetStatus(
              integration.projectId,
              "pr_merged",
              config.statusTransitions?.onPRMerge || "done",
              database,
            );
            const statusResult = await updateTaskStatus(
              task.id,
              targetStatus,
              database,
            );
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
          }
        }
      },
    );

    return;
  }
}
