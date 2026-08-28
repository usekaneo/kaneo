import type { GitlabConfig } from "../config";
import {
  createGitlabClient,
  GitlabApiError,
  type GitlabLabel,
} from "./gitlab-api";

const labelColors: Record<string, string> = {
  "priority:low": "0EA5E9",
  "priority:medium": "EAB308",
  "priority:high": "F97316",
  "priority:urgent": "EF4444",
  "status:to-do": "6B7280",
  "status:in-progress": "3B82F6",
  "status:in-review": "8B5CF6",
  "status:done": "10B981",
  "status:planned": "8B5CF6",
  "status:archived": "6B7280",
};

function getLabelColor(labelName: string): string {
  return labelColors[labelName] || "6B7280";
}

export async function listAllGitlabLabels(
  config: Pick<
    GitlabConfig,
    "baseUrl" | "accessToken" | "tokenType" | "namespace" | "projectPath"
  >,
): Promise<GitlabLabel[]> {
  const client = createGitlabClient(config);
  const all: GitlabLabel[] = [];
  let page = 1;

  while (true) {
    const batch = await client.listLabels(page, 100);
    all.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    if (page > 20) break;
  }

  return all;
}

/**
 * Adding an unknown label to a GitLab issue creates it with a random colour, so
 * the ones Kaneo owns are created up front with their intended colour.
 *
 * A failed enumeration is not a reason to skip creation: GitLab answers a
 * duplicate label with a conflict, which is exactly the "already there" signal
 * the listing would have given. Assignment then still runs, so a transient read
 * failure costs nothing.
 */
export async function ensureLabelsExistGitlab(
  config: GitlabConfig,
  labels: string[],
): Promise<void> {
  if (labels.length === 0) return;

  const client = createGitlabClient(config);

  let known = new Set<string>();
  try {
    known = new Set((await listAllGitlabLabels(config)).map((l) => l.name));
  } catch (error) {
    console.error("Failed to list GitLab labels; creating optimistically", {
      namespace: config.namespace,
      projectPath: config.projectPath,
      error,
    });
  }

  for (const name of labels) {
    if (known.has(name)) continue;
    try {
      await client.createLabel(name, getLabelColor(name));
      known.add(name);
    } catch (error) {
      if (isAlreadyExists(error)) {
        continue;
      }
      console.error(`Failed to ensure GitLab label "${name}":`, error);
    }
  }
}

/** GitLab answers a duplicate label name with 409, older versions with 400. */
export function isAlreadyExists(error: unknown): boolean {
  if (!(error instanceof GitlabApiError)) {
    return false;
  }
  return (
    error.status === 409 ||
    (error.status === 400 &&
      /already exists|has already been taken/i.test(error.body ?? ""))
  );
}

export async function addLabelsToIssueGitlab(
  config: GitlabConfig,
  issueIid: number,
  labelNames: string[],
) {
  if (labelNames.length === 0) return;

  await ensureLabelsExistGitlab(config, labelNames);

  try {
    await createGitlabClient(config).addLabelsToIssue(issueIid, labelNames);
  } catch (error) {
    console.error("Failed to add labels to GitLab issue:", error);
  }
}

export async function removeLabelGitlab(
  config: GitlabConfig,
  issueIid: number,
  labelName: string,
) {
  try {
    await createGitlabClient(config).removeLabelsFromIssue(issueIid, [
      labelName,
    ]);
  } catch (error) {
    console.error("Failed to remove label from GitLab issue:", {
      namespace: config.namespace,
      projectPath: config.projectPath,
      issueIid,
      labelName,
      error,
    });
  }
}
