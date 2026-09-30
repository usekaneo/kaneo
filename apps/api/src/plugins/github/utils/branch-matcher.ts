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
    // The title segment can be empty: slugify keeps only ASCII alphanumerics,
    // so a title written in any other script leaves nothing behind and
    // generateBranchName emits the separator with no name after it.
    .replace("\\{title\\}", "([a-z0-9-]*)");

  // Allow optional suffix after the pattern (e.g., lif-3-part-1)
  return new RegExp(`^${regexPattern}(?:-.*)?$`, "i");
}

export function extractTaskNumberFromBranch(
  branchName: string,
  config: Pick<GitHubConfig, "branchPattern" | "customBranchRegex">,
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

function extractExplicitTaskNumber(
  text: string,
  projectSlug?: string,
): number | null {
  if (projectSlug) {
    const slug = projectSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const key = text.match(
      new RegExp(`(?:^|[^\\w-])${slug}-(\\d+)(?=$|[^\\w])`, "i"),
    );
    if (key?.[1]) return Number.parseInt(key[1], 10);
  }

  const task = text.match(/\btask[:\-\s#]+(\d+)\b/i);
  return task?.[1] ? Number.parseInt(task[1], 10) : null;
}

export function extractTaskNumberFromPRTitle(
  title: string,
  projectSlug?: string,
): number | null {
  return extractExplicitTaskNumber(title, projectSlug);
}

export function extractTaskNumberFromPRBody(
  body: string,
  projectSlug?: string,
): number | null {
  return extractExplicitTaskNumber(body, projectSlug);
}

export function extractTaskNumber(
  branchName: string,
  prTitle: string | undefined,
  prBody: string | undefined,
  config: Pick<GitHubConfig, "branchPattern" | "customBranchRegex">,
  projectSlug: string,
): number | null {
  const fromBranch = extractTaskNumberFromBranch(
    branchName,
    config,
    projectSlug,
  );
  if (fromBranch !== null) return fromBranch;

  if (prTitle) {
    const fromTitle = extractTaskNumberFromPRTitle(prTitle, projectSlug);
    if (fromTitle !== null) return fromTitle;
  }

  if (prBody) {
    const fromBody = extractTaskNumberFromPRBody(prBody, projectSlug);
    if (fromBody !== null) return fromBody;
  }

  return null;
}
