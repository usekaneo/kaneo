import { and, eq, inArray } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable, taskTable } from "../../../database/schema";
import type { GitHubConfig } from "../config";
import { extractTaskNumber } from "../utils/branch-matcher";
import { extractIssueReferences } from "../utils/issue-references";

export async function resolvePullRequestTask({
  integrationId,
  projectId,
  projectSlug,
  config,
  repositoryUrl,
  pullRequest,
  database = db,
}: {
  database?: Pick<typeof db, "selectDistinct" | "query">;
  integrationId: string;
  projectId: string;
  projectSlug: string;
  config: Pick<GitHubConfig, "branchPattern" | "customBranchRegex">;
  repositoryUrl: string;
  pullRequest: {
    number: number;
    title: string;
    body: string | null;
    head: { ref: string };
  };
}) {
  const taskNumber = extractTaskNumber(
    pullRequest.head.ref,
    pullRequest.title,
    pullRequest.body ?? undefined,
    config,
    projectSlug,
  );
  if (taskNumber !== null) {
    return database.query.taskTable.findFirst({
      where: and(
        eq(taskTable.projectId, projectId),
        eq(taskTable.number, taskNumber),
      ),
    });
  }

  const issueNumbers = extractIssueReferences(
    pullRequest.title,
    pullRequest.body,
    repositoryUrl,
  );
  if (issueNumbers.length === 0) return;

  const matches = await database
    .selectDistinct({ task: taskTable })
    .from(externalLinkTable)
    .innerJoin(taskTable, eq(taskTable.id, externalLinkTable.taskId))
    .where(
      and(
        eq(externalLinkTable.integrationId, integrationId),
        eq(externalLinkTable.resourceType, "issue"),
        inArray(externalLinkTable.externalId, issueNumbers),
        eq(taskTable.projectId, projectId),
      ),
    )
    .limit(2);

  return matches.length === 1 ? matches[0]?.task : undefined;
}
