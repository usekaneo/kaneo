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
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";
import type { IssuePayload } from "./issue-opened";

type Transition = {
  eventType: "issue_closed" | "issue_reopened";
  fallbackStatus: string;
  linkState: "closed" | "opened";
};

const CLOSED: Transition = {
  eventType: "issue_closed",
  fallbackStatus: "done",
  linkState: "closed",
};

const REOPENED: Transition = {
  eventType: "issue_reopened",
  fallbackStatus: "to-do",
  linkState: "opened",
};

async function applyIssueTransition(
  payload: IssuePayload,
  transition: Transition,
  integrationId?: string,
) {
  const issue = payload.object_attributes;
  const { project } = payload;

  const baseUrl = baseUrlFromProjectWebUrl(project);
  if (!baseUrl || !project.path_with_namespace) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  for (const integration of integrations) {
    try {
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
          console.warn("Failed to parse GitLab issue metadata for state sync", {
            externalLinkId: externalLink.id,
            error,
          });
        }
      }

      // Kaneo closes and reopens the issue itself when a task moves, and that
      // write comes back as a webhook. Only a webhook carrying the same state
      // Kaneo just pushed can be that echo -- the opposite state is always a
      // real change, however soon it follows.
      const lastOutbound = existingMetadata.lastOutboundStateSyncAt;
      if (
        typeof lastOutbound === "number" &&
        Number.isFinite(lastOutbound) &&
        existingMetadata.lastOutboundState === transition.linkState
      ) {
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
        transition.eventType,
        transition.fallbackStatus,
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
          state: transition.linkState,
        },
      });
    } catch (error) {
      console.error("GitLab issue state handler failed for integration", {
        integrationId: integration.id,
        issueIid: issue.iid,
        project: project.path_with_namespace,
        error,
      });
    }
  }
}

export async function handleGitlabIssueClosed(
  payload: IssuePayload,
  integrationId?: string,
) {
  await applyIssueTransition(payload, CLOSED, integrationId);
}

export async function handleGitlabIssueReopened(
  payload: IssuePayload,
  integrationId?: string,
) {
  await applyIssueTransition(payload, REOPENED, integrationId);
}
