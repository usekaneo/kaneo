import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable, taskTable } from "../../../database/schema";
import { updateExternalLink } from "../services/link-manager";
import { findIntegrationByRepo } from "../services/task-service";

type IssueClosedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    html_url: string;
    state: string;
  };
  repository: {
    owner: { login: string };
    name: string;
    full_name: string;
  };
};

export async function handleIssueClosed(payload: IssueClosedPayload) {
  const { issue, repository } = payload;

  const integration = await findIntegrationByRepo(
    repository.owner.login,
    repository.name,
  );

  if (!integration) {
    return;
  }

  const externalLink = await db.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.integrationId, integration.id),
      eq(externalLinkTable.resourceType, "issue"),
      eq(externalLinkTable.externalId, issue.number.toString()),
    ),
  });

  if (!externalLink) {
    return;
  }

  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, externalLink.taskId),
  });

  if (!task) {
    return;
  }

  const existingMetadata = externalLink.metadata
    ? JSON.parse(externalLink.metadata)
    : {};

  if (existingMetadata.createdFrom === "kaneo") {
    return;
  }

  await db
    .update(taskTable)
    .set({ status: "done" })
    .where(eq(taskTable.id, task.id));

  await updateExternalLink(externalLink.id, {
    metadata: {
      ...existingMetadata,
      state: "closed",
    },
  });
}
