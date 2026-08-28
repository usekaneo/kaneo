import { eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "./gitlab-api";
import { parseIssueIid } from "./issue-iid";
import { isAlreadyExists, listAllGitlabLabels } from "./labels";

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

async function getGitlabIssueContext(taskId: string) {
  const externalLinks = await db.query.externalLinkTable.findMany({
    where: eq(externalLinkTable.taskId, taskId),
    with: {
      integration: true,
    },
  });

  // isActive has to be checked here: these helpers are called straight from the
  // label controllers, bypassing the plugin registry's active-integration
  // filter, so a disabled integration would otherwise keep writing to GitLab.
  const externalLink = externalLinks.find(
    (link) =>
      link.resourceType === "issue" &&
      link.integration?.type === "gitlab" &&
      link.integration.isActive === true,
  );

  if (!externalLink?.integration) {
    return null;
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(externalLink.integration.config) as GitlabConfig;
  } catch {
    return null;
  }

  if (!config.accessToken || !config.baseUrl) {
    return null;
  }

  const issueIid = parseIssueIid(externalLink.externalId);
  if (issueIid === null) {
    console.warn("Invalid GitLab issue externalId for label sync", {
      externalLinkId: externalLink.id,
      externalId: externalLink.externalId,
      taskId,
    });
    return null;
  }

  return {
    client: createGitlabClient(config),
    config,
    issueIid,
  };
}

export async function syncLabelToGitlab(
  taskId: string,
  labelName: string,
  labelColor: string,
) {
  const ctx = await getGitlabIssueContext(taskId);
  if (!ctx) return;

  const { client, config, issueIid } = ctx;

  // Creating with the intended colour is best-effort; a conflict just means it
  // is already there, and any other failure still leaves assignment worth a try
  // since GitLab will create the label itself.
  try {
    const labels = await listAllGitlabLabels(config);
    if (!labels.some((label) => label.name === labelName)) {
      await client.createLabel(labelName, toHexColor(labelColor));
    }
  } catch (error) {
    if (!isAlreadyExists(error)) {
      console.error(`Failed to create label "${labelName}" in GitLab:`, error);
    }
  }

  try {
    await client.addLabelsToIssue(issueIid, [labelName]);
  } catch (error) {
    console.error(`Failed to add label "${labelName}" to GitLab issue:`, error);
  }
}

export async function removeLabelFromGitlab(taskId: string, labelName: string) {
  const ctx = await getGitlabIssueContext(taskId);
  if (!ctx) return;

  try {
    await ctx.client.removeLabelsFromIssue(ctx.issueIid, [labelName]);
  } catch (error) {
    console.error(
      `Failed to remove label "${labelName}" from GitLab issue:`,
      error,
    );
  }
}
