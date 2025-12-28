import type { Octokit } from "octokit";

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

export function getLabelColor(labelName: string): string {
  return labelColors[labelName] || "6B7280";
}

export async function ensureLabelsExist(
  octokit: Octokit,
  owner: string,
  repo: string,
  labels: string[],
) {
  for (const labelName of labels) {
    try {
      await octokit.rest.issues.getLabel({
        owner,
        repo,
        name: labelName,
      });
    } catch {
      try {
        const color = getLabelColor(labelName);
        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: labelName,
          color,
        });
      } catch (createError) {
        console.error(`Failed to create label "${labelName}":`, createError);
      }
    }
  }
}

export async function addLabelsToIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
) {
  try {
    await ensureLabelsExist(octokit, owner, repo, labels);

    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
  } catch (error) {
    console.error("Failed to add labels to issue:", error);
  }
}

export async function removeLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labelName: string,
) {
  try {
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name: labelName,
    });
  } catch {}
}
