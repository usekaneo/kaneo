import type { IssueWrite } from "../../sync/issue-write";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "./gitlab-api";

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

// Created up front so GitLab does not pick its own colours for them.
export async function ensureLabelsExistGitlab(
  config: GitlabConfig,
  labels: string[],
  requireSuccess = false,
  write: IssueWrite = (send) => send(),
): Promise<void> {
  if (labels.length === 0) return;

  const client = createGitlabClient(config);
  const { projectPath } = config;

  let existing: string[];
  try {
    existing = (await client.listLabels(projectPath)).map((l) => l.name);
  } catch (error) {
    if (requireSuccess) throw error;
    console.error("Failed to list GitLab labels for ensureLabelsExistGitlab", {
      projectPath,
      error,
    });
    return;
  }

  for (const name of labels) {
    if (existing.includes(name)) continue;

    try {
      await write(() =>
        client.createLabel(projectPath, name, getLabelColor(name)),
      );
    } catch (error) {
      if (requireSuccess) throw error;
      console.error(`Failed to ensure GitLab label "${name}":`, error);
    }
  }
}

/** Adds and removes labels in one request, so two status labels never coexist. */
export async function updateIssueLabelsGitlab(
  config: GitlabConfig,
  issueIid: number,
  changes: { add?: string[]; remove?: string[] },
  requireSuccess = false,
  write: IssueWrite = (send) => send(),
) {
  const add = changes.add ?? [];
  // GitLab removes a label when it appears in both lists. Reapplying a
  // priority or status must leave its label present.
  const remove = (changes.remove ?? []).filter((label) => !add.includes(label));

  if (add.length === 0 && remove.length === 0) return;

  await ensureLabelsExistGitlab(config, add, requireSuccess, write);

  const body: Record<string, string> = {};
  if (add.length > 0) {
    body.add_labels = add.join(",");
  }
  if (remove.length > 0) {
    body.remove_labels = remove.join(",");
  }

  try {
    await write(() =>
      createGitlabClient(config).updateIssue(
        config.projectPath,
        issueIid,
        body,
      ),
    );
  } catch (error) {
    if (requireSuccess) throw error;
    console.error("Failed to update GitLab issue labels:", {
      projectPath: config.projectPath,
      issueIid,
      error,
    });
  }
}

export async function addLabelsToIssueGitlab(
  config: GitlabConfig,
  issueIid: number,
  labelNames: string[],
  requireSuccess = false,
  write: IssueWrite = (send) => send(),
) {
  await updateIssueLabelsGitlab(
    config,
    issueIid,
    { add: labelNames },
    requireSuccess,
    write,
  );
}

export async function removeLabelGitlab(
  config: GitlabConfig,
  issueIid: number,
  labelName: string,
) {
  await updateIssueLabelsGitlab(config, issueIid, { remove: [labelName] });
}
