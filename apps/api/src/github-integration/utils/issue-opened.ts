import type {
  EmitterWebhookEvent,
  EmitterWebhookEventName,
} from "@octokit/webhooks";
import type { Octokit } from "octokit";
import createTask from "../../task/controllers/create-task";
import getGithubIntegrationByRepositoryId from "../controllers/get-github-integration-by-repository-id";
import { extractIssuePriority } from "./extract-issue-priority";
import { formatGitHubComment } from "./format-github-comment";
import { formatTaskDescription } from "./format-task-description";

export type HandlerFunction<
  TName extends EmitterWebhookEventName,
  TTransformed = unknown,
> = (event: EmitterWebhookEvent<TName> & TTransformed) => void;

export const handleIssueOpened: HandlerFunction<
  "issues.opened",
  { octokit: Octokit }
> = async ({ payload, octokit }): Promise<void> => {
  try {
    if (payload.issue.title.startsWith("[Kaneo]")) {
      console.log("Skipping Kaneo-created issue to avoid loop");
      return;
    }

    const integration = await getGithubIntegrationByRepositoryId(
      payload.repository.owner.login,
      payload.repository.name,
    );

    if (!integration || !integration.isActive) {
      console.log(
        "No active Kaneo integration found for repository:",
        payload.repository.full_name,
      );
      return;
    }

    const taskPriority = extractIssuePriority(payload.issue.labels);

    const task = await createTask({
      projectId: integration.projectId,
      title: payload.issue.title,
      description: formatTaskDescription({
        number: payload.issue.number,
        body: payload.issue.body,
        html_url: payload.issue.html_url,
        user: payload.issue.user,
        repository: payload.repository,
      }),
      status: "to-do",
      priority: taskPriority,
      dueDate: new Date(),
      userEmail: undefined,
    });

    try {
      await octokit.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        body: formatGitHubComment({
          id: task.id,
          title: payload.issue.title,
          priority: task.priority || "medium",
          status: task.status || "to-do",
        }),
      });
    } catch (commentError) {
      console.error("Failed to add comment to GitHub issue:", commentError);
    }
  } catch (error) {
    console.error("Failed to create Kaneo task from GitHub issue:", error);
  }
};
