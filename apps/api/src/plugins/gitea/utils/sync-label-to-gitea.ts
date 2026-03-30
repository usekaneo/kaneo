import { eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "./gitea-api";

const namedColorToHex: Record<string, string> = {
  red: "EF4444",
  orange: "F97316",
  amber: "F59E0B",
  yellow: "EAB308",
  lime: "84CC16",
  green: "22C55E",
  emerald: "10B981",
  teal: "14B8A6",
  cyan: "06B6D4",
  sky: "0EA5E9",
  blue: "3B82F6",
  indigo: "6366F1",
  violet: "8B5CF6",
  purple: "A855F7",
  fuchsia: "D946EF",
  pink: "EC4899",
  rose: "F43F5E",
  gray: "6B7280",
  slate: "64748B",
  zinc: "71717A",
  neutral: "737373",
  stone: "78716C",
};

function toHexColor(color: string): string {
  const lower = color.toLowerCase().replace(/^#/, "");
  if (namedColorToHex[lower]) {
    return namedColorToHex[lower];
  }
  if (/^[0-9a-f]{6}$/i.test(lower)) {
    return lower;
  }
  if (/^[0-9a-f]{3}$/i.test(lower)) {
    const [r, g, b] = lower.split("");
    return `${r}${r}${g}${g}${b}${b}`;
  }
  return "6B7280";
}

async function getGiteaIssueContext(taskId: string) {
  const externalLink = await db.query.externalLinkTable.findFirst({
    where: eq(externalLinkTable.taskId, taskId),
    with: {
      integration: true,
    },
  });

  if (!externalLink || externalLink.resourceType !== "issue") {
    return null;
  }

  const integration = externalLink.integration;
  if (!integration || integration.type !== "gitea") {
    return null;
  }

  let config: GiteaConfig;
  try {
    config = JSON.parse(integration.config) as GiteaConfig;
  } catch {
    return null;
  }

  if (!config.accessToken || !config.baseUrl) {
    return null;
  }

  const client = createGiteaClient(config);
  const issueNumber = Number.parseInt(externalLink.externalId, 10);

  return {
    client,
    config,
    issueNumber,
  };
}

export async function syncLabelToGitea(
  taskId: string,
  labelName: string,
  labelColor: string,
) {
  const ctx = await getGiteaIssueContext(taskId);
  if (!ctx) return;

  const { client, config, issueNumber } = ctx;
  const color = toHexColor(labelColor);

  const labels = await client.listLabels(
    config.repositoryOwner,
    config.repositoryName,
  );
  let label = labels.find((l) => l.name === labelName);

  if (!label) {
    try {
      label = await client.createLabel(
        config.repositoryOwner,
        config.repositoryName,
        labelName,
        color,
      );
    } catch (error) {
      console.error(`Failed to create label "${labelName}" in Gitea:`, error);
      return;
    }
  }

  try {
    const issue = await client.getIssue(
      config.repositoryOwner,
      config.repositoryName,
      issueNumber,
    );
    const existingIds = (issue.labels ?? []).map((l) => l.id);
    if (existingIds.includes(label.id)) {
      return;
    }
    await client.addLabelsToIssue(
      config.repositoryOwner,
      config.repositoryName,
      issueNumber,
      [label.id],
    );
  } catch (error) {
    console.error(`Failed to add label "${labelName}" to Gitea issue:`, error);
  }
}

export async function removeLabelFromGitea(taskId: string, labelName: string) {
  const ctx = await getGiteaIssueContext(taskId);
  if (!ctx) return;

  const { client, config, issueNumber } = ctx;

  const labels = await client.listLabels(
    config.repositoryOwner,
    config.repositoryName,
  );
  const label = labels.find((l) => l.name === labelName);
  if (!label) return;

  try {
    await client.removeLabelFromIssue(
      config.repositoryOwner,
      config.repositoryName,
      issueNumber,
      label.id,
    );
  } catch (error) {
    console.error(
      `Failed to remove label "${labelName}" from Gitea issue:`,
      error,
    );
  }
}
