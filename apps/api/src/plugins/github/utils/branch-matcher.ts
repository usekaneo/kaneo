import type { GitHubConfig } from "../config";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function generateBranchName(
  pattern: string,
  projectSlug: string,
  taskNumber: number,
  taskTitle: string,
): string {
  return pattern
    .replace("{slug}", projectSlug.toLowerCase())
    .replace("{number}", taskNumber.toString())
    .replace("{title}", slugify(taskTitle));
}

export function createBranchRegex(
  pattern: string,
  projectSlug: string,
): RegExp {
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regexPattern = escapedPattern
    .replace("\\{slug\\}", projectSlug.toLowerCase())
    .replace("\\{number\\}", "(\\d+)")
    .replace("\\{title\\}", "([a-z0-9-]+)");

  return new RegExp(`^${regexPattern}$`, "i");
}

export function extractTaskNumberFromBranch(
  branchName: string,
  config: GitHubConfig,
  projectSlug: string,
): number | null {
  if (config.customBranchRegex) {
    try {
      const customRegex = new RegExp(config.customBranchRegex, "i");
      const match = branchName.match(customRegex);
      if (match?.[1]) {
        const num = Number.parseInt(match[1], 10);
        if (!Number.isNaN(num)) return num;
      }
    } catch {
      console.error("Invalid custom branch regex:", config.customBranchRegex);
    }
    return null;
  }

  const pattern = config.branchPattern || "{slug}-{number}";
  const regex = createBranchRegex(pattern, projectSlug);
  const match = branchName.match(regex);

  if (match?.[1]) {
    const num = Number.parseInt(match[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  return null;
}

export function extractTaskNumberFromPRTitle(title: string): number | null {
  const patterns = [
    /\[(\d+)\]/,
    /#(\d+)/,
    /\((\d+)\)/,
    /^(\d+)[:\-\s]/,
    /task[:\-\s]*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) {
      const num = Number.parseInt(match[1], 10);
      if (!Number.isNaN(num)) return num;
    }
  }

  return null;
}

export function extractTaskNumberFromPRBody(body: string): number | null {
  const patterns = [
    /task[:\-\s#]*(\d+)/i,
    /closes[:\-\s#]*(\d+)/i,
    /fixes[:\-\s#]*(\d+)/i,
    /resolves[:\-\s#]*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match?.[1]) {
      const num = Number.parseInt(match[1], 10);
      if (!Number.isNaN(num)) return num;
    }
  }

  return null;
}

export function extractTaskNumber(
  branchName: string,
  prTitle: string | undefined,
  prBody: string | undefined,
  config: GitHubConfig,
  projectSlug: string,
): number | null {
  const fromBranch = extractTaskNumberFromBranch(
    branchName,
    config,
    projectSlug,
  );
  if (fromBranch) return fromBranch;

  if (prTitle) {
    const fromTitle = extractTaskNumberFromPRTitle(prTitle);
    if (fromTitle) return fromTitle;
  }

  if (prBody) {
    const fromBody = extractTaskNumberFromPRBody(prBody);
    if (fromBody) return fromBody;
  }

  return null;
}
