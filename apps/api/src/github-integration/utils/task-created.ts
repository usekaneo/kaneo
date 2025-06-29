import getGithubIntegration from "../controllers/get-github-integration";
import createGithubApp from "./create-github-app";

const githubApp = createGithubApp();

export async function handleTaskCreated(data: {
  taskId: string;
  userEmail: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  number: number;
  projectId: string;
}) {
  if (!githubApp) {
    console.log("No GitHub app found");
    return;
  }

  const { taskId, userEmail, title, description, priority, status, projectId } =
    data;

  try {
    const integration = await getGithubIntegration(projectId);

    if (!integration || !integration.isActive) {
      console.log("No active GitHub integration found for project:", projectId);
      return;
    }

    const { repositoryOwner, repositoryName } = integration;
    console.log(
      "Creating GitHub issue for repository:",
      `${repositoryOwner}/${repositoryName}`,
    );

    let installationId = integration.installationId;

    if (!installationId) {
      const { data: installation } =
        await githubApp.octokit.rest.apps.getRepoInstallation({
          owner: repositoryOwner,
          repo: repositoryName,
        });
      installationId = installation.id;
    }

    const octokit = await githubApp.getInstallationOctokit(installationId);

    await octokit.rest.issues.create({
      owner: repositoryOwner,
      repo: repositoryName,
      title: `[Kaneo] ${title}`,
      body: `**Task created in Kaneo**

**Description:** ${description || "No description provided"}

**Details:**
- Task ID: ${taskId}
- Status: ${status}
- Priority: ${priority || "Not set"}
- Assigned to: ${userEmail || "Unassigned"}

---
*This issue was automatically created from Kaneo task management system.*`,
      labels: ["kaneo", `priority:${priority || "low"}`, `status:${status}`],
    });
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
  }
}
