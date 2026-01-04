import { eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { getInstallationOctokit } from "./github-app";

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

async function getGitHubContext(taskId: string) {
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
  if (!integration || integration.type !== "github") {
    return null;
  }

  let config: {
    repositoryOwner: string;
    repositoryName: string;
    installationId?: number;
  };
  try {
    config = JSON.parse(integration.config);
  } catch {
    return null;
  }

  if (!config.installationId) {
    return null;
  }

  const octokit = await getInstallationOctokit(config.installationId);
  if (!octokit) {
    return null;
  }

  return {
    octokit,
    owner: config.repositoryOwner,
    repo: config.repositoryName,
    issueNumber: Number.parseInt(externalLink.externalId, 10),
  };
}

export async function syncLabelToGitHub(
  taskId: string,
  labelName: string,
  labelColor: string,
) {
  const ctx = await getGitHubContext(taskId);
  if (!ctx) return;

  const { octokit, owner, repo, issueNumber } = ctx;
  const color = toHexColor(labelColor);

  try {
    await octokit.rest.issues.getLabel({
      owner,
      repo,
      name: labelName,
    });
  } catch {
    try {
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: labelName,
        color,
      });
    } catch (createError) {
      console.error(
        `Failed to create label "${labelName}" in GitHub:`,
        createError,
      );
      return;
    }
  }

  try {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: [labelName],
    });
  } catch (error) {
    console.error(`Failed to add label "${labelName}" to GitHub issue:`, error);
  }
}

export async function removeLabelFromGitHub(taskId: string, labelName: string) {
  const ctx = await getGitHubContext(taskId);
  if (!ctx) return;

  const { octokit, owner, repo, issueNumber } = ctx;

  try {
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name: labelName,
    });
  } catch (error) {
    console.error(
      `Failed to remove label "${labelName}" from GitHub issue:`,
      error,
    );
  }
}
