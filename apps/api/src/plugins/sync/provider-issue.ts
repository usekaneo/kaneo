import type { GiteaConfig } from "../gitea/config";
import { createGiteaClient } from "../gitea/utils/gitea-api";
import type { GitHubConfig } from "../github/config";
import {
  formatIssueBody,
  formatTaskDescriptionFromIssue,
} from "../github/utils/format";
import { getVerifiedInstallationOctokit } from "../github/utils/github-app";
import type { GitlabConfig } from "../gitlab/config";
import { createGitlabClient } from "../gitlab/utils/gitlab-api";

export type IssueValues = {
  title: string;
  description: string;
  state: "open" | "closed";
};

export async function providerIssue(
  integration: { type: string; config: string },
  link: { externalId: string; taskId: string },
) {
  const number = Number(link.externalId);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error("Invalid issue number");
  const config = JSON.parse(integration.config);
  const owner = config.repositoryOwner;
  const repo = config.repositoryName;
  const normalize = (issue: {
    title: string;
    body?: string | null;
    description?: string | null;
    state: string;
    updated_at?: string;
    content_version?: number;
    labels?: Array<string | { name?: string }>;
  }) => ({
    title: issue.title,
    description: formatTaskDescriptionFromIssue(
      issue.body ?? issue.description ?? "",
      link.taskId,
    ),
    state: issue.state === "closed" ? ("closed" as const) : ("open" as const),
    updatedAt: issue.updated_at ?? null,
    contentVersion: issue.content_version ?? null,
    labels: (issue.labels ?? []).flatMap((label) => {
      const name = typeof label === "string" ? label : label.name;
      return name ? [name] : [];
    }),
  });
  if (integration.type === "gitea") {
    const client = createGiteaClient(config as GiteaConfig);
    let contentVersion: number | undefined;
    return {
      read: async () => {
        const issue = await client.getIssue(owner, repo, number);
        contentVersion = issue.content_version;
        return normalize(issue);
      },
      write: async (values: IssueValues) =>
        normalize(
          await client.updateIssue(owner, repo, number, {
            title: values.title,
            body: formatIssueBody(values.description, link.taskId),
            state: values.state,
            ...(contentVersion === undefined
              ? {}
              : { content_version: contentVersion }),
          }),
        ),
    };
  }
  if (integration.type === "gitlab") {
    const client = createGitlabClient(config as GitlabConfig);
    return {
      read: async () => {
        const issue = await client.getIssue(config.projectPath, number);
        if (issue.confidential)
          throw new Error("Confidential issue cannot be synchronized");
        return normalize(issue);
      },
      write: async (values: IssueValues) =>
        normalize(
          await client.updateIssue(config.projectPath, number, {
            title: values.title,
            description: formatIssueBody(values.description, link.taskId),
            state_event: values.state === "closed" ? "close" : "reopen",
          }),
        ),
    };
  }
  const octokit = await getVerifiedInstallationOctokit(
    config as GitHubConfig,
    true,
  );
  return {
    read: async () =>
      normalize(
        (
          await octokit.rest.issues.get({
            owner,
            repo,
            issue_number: number,
            request: { timeout: 10_000 },
          })
        ).data,
      ),
    write: async (values: IssueValues) =>
      normalize(
        (
          await octokit.rest.issues.update({
            owner,
            repo,
            issue_number: number,
            title: values.title,
            body: formatIssueBody(values.description, link.taskId),
            state: values.state,
            request: { timeout: 10_000 },
          })
        ).data,
      ),
  };
}
