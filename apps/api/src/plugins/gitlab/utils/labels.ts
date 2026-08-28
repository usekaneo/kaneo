import type { GitlabConfig } from "../config";
import { createGitlabClient, type GitlabLabel } from "./gitlab-api";

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
 */
export async function ensureLabelsExistGitlab(
  config: GitlabConfig,
  labels: string[],
): Promise<void> {
  if (labels.length === 0) return;

  const client = createGitlabClient(config);

  let existing: GitlabLabel[];
  try {
    existing = await listAllGitlabLabels(config);
  } catch (error) {
    console.error("Failed to list GitLab labels for ensureLabelsExistGitlab", {
      namespace: config.namespace,
      projectPath: config.projectPath,
      error,
    });
    return;
  }

  const known = new Set(existing.map((label) => label.name));

  for (const name of labels) {
    if (known.has(name)) continue;
    try {
      await client.createLabel(name, getLabelColor(name));
      known.add(name);
    } catch (error) {
      // A concurrent webhook may have created it between the list and now.
      console.error(`Failed to ensure GitLab label "${name}":`, error);
    }
  }
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
