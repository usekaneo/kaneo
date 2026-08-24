import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import {
  OUTBOUND_STATE_ECHO_WINDOW_MS,
  parseIssueUpdatedAtMs,
} from "../utils/outbound-echo";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type IssueClosedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    url: string;
    state: string;
    action: string;
    updated_at?: string;
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueClosed(
  payload: IssueClosedPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project } = payload;

  if (issue.action !== "close") {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  for (const integration of integrations) {
    const externalLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "issue"),
        eq(externalLinkTable.externalId, issue.iid.toString()),
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
        console.warn("Failed to parse GitLab issue metadata for close sync", {
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
