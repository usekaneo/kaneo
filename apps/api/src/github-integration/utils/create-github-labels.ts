import type { Octokit } from "octokit";
import { getLabelColor } from "./github-label-colors";

export async function createGitHubLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  labels: string[],
) {
  for (const labelName of labels) {
    try {
      try {
        await octokit.rest.issues.getLabel({
          owner,
          repo,
          name: labelName,
        });
        console.log(`Label "${labelName}" already exists`);
      } catch (_error) {
        const color = getLabelColor(labelName);
        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: labelName,
          color,
          description: `Kaneo ${labelName.replace(":", " ")} label`,
        });
        console.log(`Created label "${labelName}" with color ${color}`);
      }
    } catch (error) {
      console.error(`Failed to create label "${labelName}":`, error);
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
    await createGitHubLabels(octokit, owner, repo, labels);

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
