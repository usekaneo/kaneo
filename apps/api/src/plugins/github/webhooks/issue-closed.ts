import { issueEditScope } from "../utils/deferred-issue-edit";
import { deferIssueEdit } from "../services/deferred-issue-edits";
import type { GitHubConfig } from "../config";
import { getVerifiedInstallationOctokit } from "../utils/github-app";
import { inboundEcho, withEchoConfirmation } from "../utils/inbound-echo";
import { inboundStamp, type SyncStamp } from "../utils/sync-echo";
import { withIntegrationLink } from "../services/with-integration-link";
import { linkedTaskScope } from "../services/integration-task-scope";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../services/link-manager";
import {
  findAllIntegrationsByRepo,
  isTaskInFinalState,
  updateTaskStatus,
} from "../services/task-service";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import { resolveTargetStatus } from "../utils/resolve-column";

type IssueClosedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    html_url: string;
    state: string;
    updated_at?: string;
  };
  installation?: { id: number };
  repository: {
    id: number;
    owner: { login: string };
    name: string;
    full_name: string;
  };
};

export async function handleIssueClosed(payload: IssueClosedPayload) {
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

    const readCurrent = async () => {
      const config = JSON.parse(integration.config) as GitHubConfig;
      const octokit = await getVerifiedInstallationOctokit(config);
      return (
        await octokit.rest.issues.get({
          owner: config.repositoryOwner,
          repo: config.repositoryName,
          issue_number: issue.number,
        })
      ).data;
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
              source: "issue_closed",
            });

            if (existingMetadata.createdFrom === "kaneo") {
              return;
            }

            if (
              inboundEcho(
                existingMetadata.lastSync?.state,
                "closed",
                issue.updated_at,
                current?.state,
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

            const targetStatus = await resolveTargetStatus(
              task.projectId,
              "issue_closed",
              "done",
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
                  state: "closed",
                  lastSync: {
                    ...existingMetadata.lastSync,
                    state: inboundStamp(
                      existingMetadata.lastSync?.state,
                      "closed",
                      "github",
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
  }
}
