import type { GiteaConfig } from "../config";
import { createGiteaClient, type GiteaLabel } from "./gitea-api";

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

export async function ensureLabelsExistGitea(
  config: GiteaConfig,
  labels: string[],
): Promise<Map<string, number>> {
  const client = createGiteaClient(config);
  const map = new Map<string, number>();
  const { repositoryOwner, repositoryName } = config;

  let existingLabels: GiteaLabel[];
  try {
    existingLabels = await client.listLabels(repositoryOwner, repositoryName);
  } catch (error) {
    console.error("Failed to list Gitea labels for ensureLabelsExistGitea", {
      repositoryOwner,
      repositoryName,
      error,
    });
    return map;
  }

  const nameToId = new Map(existingLabels.map((l) => [l.name, l.id]));

  for (const name of labels) {
    try {
      const existingId = nameToId.get(name);
      if (existingId !== undefined) {
        map.set(name, existingId);
        continue;
      }

      const color = getLabelColor(name);
      const created = await client.createLabel(
        repositoryOwner,
        repositoryName,
        name,
        color,
      );
      nameToId.set(name, created.id);
      map.set(name, created.id);
    } catch (error) {
      console.error(`Failed to ensure Gitea label "${name}":`, error);
    }
  }
  return map;
}

export async function addLabelsToIssueGitea(
  config: GiteaConfig,
  issueIndex: number,
  labelNames: string[],
) {
  if (labelNames.length === 0) return;

  const nameToId = await ensureLabelsExistGitea(config, labelNames);
  const ids: number[] = [];
  for (const name of labelNames) {
    const id = nameToId.get(name);
    if (id !== undefined) {
      ids.push(id);
    }
  }

  if (ids.length === 0) return;

  try {
    await client.addLabelsToIssue(
      config.repositoryOwner,
      config.repositoryName,
      issueIndex,
      ids,
    );
  } catch (error) {
    console.error("Failed to add labels to Gitea issue:", error);
  }
}

export async function removeLabelGitea(
  config: GiteaConfig,
  issueIndex: number,
  labelName: string,
) {
  const client = createGiteaClient(config);
  let labels: GiteaLabel[];
  try {
    labels = await client.listLabels(
      config.repositoryOwner,
      config.repositoryName,
    );
  } catch (error) {
    console.error("Failed to list Gitea labels for removal:", {
      repositoryOwner: config.repositoryOwner,
      repositoryName: config.repositoryName,
      issueIndex,
      labelName,
      error,
    });
    return;
  }

  const label = labels.find((l) => l.name === labelName);
  if (!label) return;

  try {
    await client.removeLabelFromIssue(
      config.repositoryOwner,
      config.repositoryName,
      issueIndex,
      label.id,
    );
  } catch (error) {
    console.error("Failed to remove label from Gitea issue:", {
      repositoryOwner: config.repositoryOwner,
      repositoryName: config.repositoryName,
      issueIndex,
      labelName,
      labelId: label.id,
      error,
    });
  }
}
