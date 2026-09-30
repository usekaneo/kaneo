import { issueEditScope } from "../../github/utils/deferred-issue-edit";
import { deferIssueEdit } from "../../github/services/deferred-issue-edits";
import { inboundStamp } from "../../github/utils/sync-echo";
import { withIntegrationLink } from "../../github/services/with-integration-link";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import { parseLinkMetadata } from "../../github/utils/parse-link-metadata";
import type { SyncStamp } from "../../github/utils/sync-echo";
import {
  inboundEcho,
  PendingResponseTimeout,
  withEchoConfirmation,
} from "../../github/utils/inbound-echo";
import { linkedTaskScope } from "../../github/services/integration-task-scope";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import {
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
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

type IssueReopenedPayload = {
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

export async function handleGiteaIssueReopened(
  payload: IssueReopenedPayload,
  integrationId?: string,
) {
  if (payload.action !== "reopened") {
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
    try {
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

      const readCurrent = async () => {
        const config = JSON.parse(integration.config) as GiteaConfig;
        return await createGiteaClient(config).getIssue(
          config.repositoryOwner,
          config.repositoryName,
          issue.number,
        );
      };
      await withEchoConfirmation(
        readCurrent,
        (current, confirmation) =>
          withIntegrationLink(
            externalLink,
            integration,
            async (db, afterCommit, externalLink) => {
              const task = await db.query.taskTable.findFirst({
                where: linkedTaskScope(
                  externalLink.taskId,
                  integration.projectId,
                ),
              });

              if (!task) {
                return;
              }
              const existingMetadata = parseLinkMetadata<
                Record<string, unknown> & { lastSync?: { state?: SyncStamp } }
              >(externalLink.metadata, {
                externalLinkId: externalLink.id,
                source: "gitea_issue_reopened",
              });
              if (
                inboundEcho(
                  existingMetadata.lastSync?.state,
                  "open",
                  issue.updated_at,
                  current ? (current.state ?? issue.state) : undefined,
                  {
                    linkId: externalLink.id,
                    field: "state",
                    localValue: (await isTaskInFinalState(task, db))
                      ? "closed"
                      : "open",
                    confirmation,
                  },
                )
              )
                return;
              const lastOutbound = existingMetadata.lastOutboundStateSyncAt;
              if (
                typeof lastOutbound === "number" &&
                Number.isFinite(lastOutbound) &&
                existingMetadata.state === "open"
              ) {
                const eventMs = parseIssueUpdatedAtMs(issue);
                if (
                  eventMs !== null &&
                  Math.abs(eventMs - lastOutbound) <=
                    OUTBOUND_STATE_ECHO_WINDOW_MS
                ) {
                  return;
                }
              }

              const targetStatus = await resolveTargetStatus(
                task.projectId,
                "issue_reopened",
                "to-do",
                db,
              );

              const statusResult = await updateTaskStatus(
                task.id,
                targetStatus,
                db,
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

              await updateExternalLink(
                externalLink.id,
                {
                  metadata: {
                    ...existingMetadata,
                    state: "open",
                    lastSync: {
                      ...existingMetadata.lastSync,
                      state: inboundStamp(
                        existingMetadata.lastSync?.state,
                        "open",
                        "gitea",
                        current?.updated_at ?? issue.updated_at,
                      ),
                    },
                  },
                },
                db,
              );
            },
            {
              validate: (binding) =>
                issueEditScope(binding) === issueEditScope(integration),
            },
          ),
        () => deferIssueEdit(externalLink, integration, ["state"]),
      );
    } catch (error) {
      if (error instanceof PendingResponseTimeout) throw error;
      console.error("Gitea issue_reopened handler failed for integration", {
        integrationId: integration.id,
        issueNumber: issue.number,
        repository: `${owner}/${repository.name}`,
        error,
      });
    }
  }
}
