import db from "../../../database";
import {
  findTaskByLink,
  findTaskByNumber,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import { extractTaskNumberGitlab } from "../utils/branch-matcher";

export async function resolveMergeRequestTask({
  projectId,
  projectSlug,
  config,
  mergeRequest,
  database = db,
}: {
  database?: Pick<typeof db, "query">;
  projectId: string;
  projectSlug: string;
  config: GitlabConfig;
  mergeRequest: {
    title: string;
    description: string | null;
    source_branch: string;
  };
}) {
  const taskNumber = extractTaskNumberGitlab(
    mergeRequest.source_branch,
    mergeRequest.title,
    mergeRequest.description ?? undefined,
    config,
    projectSlug,
  );
  const numberedTask = taskNumber
    ? await findTaskByNumber(projectId, taskNumber, database)
    : undefined;

  return (
    numberedTask ??
    findTaskByLink(
      projectId,
      [mergeRequest.title, mergeRequest.description],
      database,
    )
  );
}
