import type {
  EmitterWebhookEvent,
  EmitterWebhookEventName,
} from "@octokit/webhooks";
import { eq } from "drizzle-orm";
import type { Octokit } from "octokit";
import db from "../../database";
import { taskTable } from "../../database/schema";
import getGithubIntegrationByRepositoryId from "../controllers/get-github-integration-by-repository-id";

export type HandlerFunction<
  TName extends EmitterWebhookEventName,
  TTransformed = unknown,
> = (event: EmitterWebhookEvent<TName> & TTransformed) => void;

export const handleIssueClosed: HandlerFunction<
  "issues.closed",
  { octokit: Octokit }
> = async ({ payload }): Promise<void> => {
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

    const tasks = await db.query.taskTable.findMany({
      where: eq(taskTable.projectId, integration.projectId),
    });

    const kaneoTask = tasks.find((task) =>
      task.description?.includes(
        `Created from GitHub issue: ${payload.issue.html_url}`,
      ),
    );

    if (!kaneoTask) {
      console.log(
        "Kaneo task not found for GitHub issue:",
        payload.issue.html_url,
      );
      return;
    }

    try {
      await db
        .update(taskTable)
        .set({
          status: "done",
        })
        .where(eq(taskTable.id, kaneoTask.id));

      console.log(`Updated Kaneo task ${kaneoTask.id} status to "done"`);
    } catch (error) {
      console.error("Failed to update Kaneo task status:", error);
    }
  } catch (error) {
    console.error("Failed to handle GitHub issue closed:", error);
  }
};
