import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable, taskTable } from "../../../database/schema";
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

export async function handleGiteaIssueClosed(payload: IssueClosedPayload) {
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

    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, externalLink.taskId),
    });

    if (!task) {
      continue;
    }

    let existingMetadata: Record<string, unknown> = {};
    if (externalLink.metadata) {
      try {
        existingMetadata = JSON.parse(externalLink.metadata) as Record<
          string,
          unknown
        >;
      } catch (error) {
        console.warn("Failed to parse Gitea issue metadata for close sync", {
          externalLinkId: externalLink.id,
          metadata: externalLink.metadata,
          error,
        });
      }
    }

    const lastOutbound = existingMetadata.lastOutboundStateSyncAt;
    if (typeof lastOutbound === "number" && Number.isFinite(lastOutbound)) {
      const eventMs = parseIssueUpdatedAtMs(issue);
      if (
        eventMs !== null &&
        Math.abs(eventMs - lastOutbound) <= OUTBOUND_STATE_ECHO_WINDOW_MS
      ) {
        continue;
      }
    }

    const targetStatus = await resolveTargetStatus(
      task.projectId,
      "issue_closed",
      "done",
    );

    const statusResult = await updateTaskStatus(task.id, targetStatus);
    if (
      statusResult.applied &&
      statusResult.before.status !== statusResult.after.status
    ) {
      await publishEvent("task.status_changed", {
        taskId: statusResult.after.id,
        projectId: statusResult.after.projectId,
        userId: null,
        oldStatus: statusResult.before.status,
        newStatus: statusResult.after.status,
        title: statusResult.after.title,
        assigneeId: statusResult.after.userId,
        type: "status_changed",
      });
    }

    await updateExternalLink(externalLink.id, {
      metadata: {
        ...existingMetadata,
        state: "closed",
      },
    });
  }
}
