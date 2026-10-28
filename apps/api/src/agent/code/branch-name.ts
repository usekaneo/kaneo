import type { GitHubConfig } from "../../plugins/github/config";
import { generateBranchName } from "../../plugins/github/utils/branch-matcher";

const DEFAULT_PATTERN = "{slug}-{number}";

/**
 * The integration's own branch pattern plus `-kaneo-xxxxxx`. The matcher
 * accepts a trailing `-…`, so the opened PR links to the task like a branch
 * a person created. Custom regexes cannot be generated from; they fall back
 * to the default pattern and the PR title's task key.
 */
export function codeJobBranchName(
  config: Pick<GitHubConfig, "branchPattern" | "customBranchRegex">,
  projectSlug: string,
  task: { number: number | null; title: string },
  jobId: string,
) {
  const suffix = `kaneo-${jobId.slice(-6).toLowerCase()}`;
  if (task.number === null) return `kaneo-agent-${suffix}`;
  const pattern =
    !config.customBranchRegex && config.branchPattern
      ? config.branchPattern
      : DEFAULT_PATTERN;
  const base = generateBranchName(
    pattern,
    projectSlug,
    task.number,
    task.title,
  ).replace(/-+$/, "");
  return `${base}-${suffix}`;
}

export function taskKey(projectSlug: string, taskNumber: number | null) {
  return taskNumber === null
    ? null
    : `${projectSlug.toUpperCase()}-${taskNumber}`;
}

/** PR titles lead with the task key, the fallback link for custom regexes. */
export function pullRequestTitle(key: string | null, title: string) {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!key) return clean.slice(0, 256);
  const withoutKey = clean.toUpperCase().startsWith(`${key}`)
    ? clean.slice(key.length).replace(/^[\s:–-]+/, "")
    : clean;
  return `${key}: ${withoutKey}`.slice(0, 256);
}
