import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import { parseLinkMetadata } from "../../github/utils/parse-link-metadata";
import {
  confirmedOutboundEcho,
  type SyncStamp,
} from "../../github/utils/sync-echo";
import {
  linkedTaskScope,
  withIntegrationTask,
} from "../../github/services/integration-task-scope";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import {
  OUTBOUND_STATE_ECHO_WINDOW_MS,
  parseIssueUpdatedAtMs,
} from "../utils/outbound-echo";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type IssueClosedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    html_url: string;
    state: string;
    updated_at?: string;
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGiteaIssueClosed(
  payload: IssueClosedPayload,
  integrationId?: string,
) {
  if (payload.action !== "closed") {
    return;
  }

  const { issue, repository } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
    integrationId,
  );

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

    const metadata = parseLinkMetadata<{ lastSync?: { state?: SyncStamp } }>(
      externalLink.metadata,
      { externalLinkId: externalLink.id, source: "gitea_issue_closed" },
    );
    const stateEcho = await confirmedOutboundEcho(
      metadata.lastSync?.state,
      "closed",
      issue.updated_at,
      async () => {
        const config = JSON.parse(integration.config) as GiteaConfig;
        return (
          await createGiteaClient(config).getIssue(
            config.repositoryOwner,
            config.repositoryName,
            issue.number,
          )
        ).state;
      },
    );
    await withIntegrationTask(
      externalLink.taskId,
      integration,
      async (db, afterCommit) => {
        const task = await db.query.taskTable.findFirst({
          where: linkedTaskScope(externalLink.taskId, integration.projectId),
        });

        if (!task) {
          return;
        }

        let existingMetadata: Record<string, unknown> = {};
        if (externalLink.metadata) {
          try {
            existingMetadata = JSON.parse(externalLink.metadata) as Record<
              string,
              unknown
            >;
          } catch (error) {
            console.warn(
              "Failed to parse Gitea issue metadata for close sync",
              {
                externalLinkId: externalLink.id,
                metadata: externalLink.metadata,
                error,
              },
            );
          }
        }
        if (stateEcho) return;
        const lastOutbound = existingMetadata.lastOutboundStateSyncAt;
        if (
          typeof lastOutbound === "number" &&
          Number.isFinite(lastOutbound) &&
          existingMetadata.state === "closed"
        ) {
          const eventMs = parseIssueUpdatedAtMs(issue);
          if (
            eventMs !== null &&
            Math.abs(eventMs - lastOutbound) <= OUTBOUND_STATE_ECHO_WINDOW_MS
          ) {
            return;
          }
        }

        const targetStatus = await resolveTargetStatus(
          task.projectId,
          "issue_closed",
          "done",
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
              state: "closed",
            },
          },
          db,
        );
      },
    );
  }
}
