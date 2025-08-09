import { createGiteaClient, giteaApiCall } from "./create-gitea-client";
import { getLabelColor } from "./gitea-label-colors";

interface GiteaLabel {
  id: number;
  name: string;
  color: string;
  description: string;
}

export async function createGiteaLabels(
  owner: string,
  repo: string,
  labels: string[],
  projectId: string,
) {
  const client = await createGiteaClient(projectId);
  if (!client) {
    throw new Error("Failed to create Gitea client");
  }

  for (const labelName of labels) {
    try {
      // Check if label already exists
      try {
        await giteaApiCall<GiteaLabel>(
          client,
          `repos/${owner}/${repo}/labels/${encodeURIComponent(labelName)}`,
          {
            method: "GET",
          },
        );
        console.log(`Label "${labelName}" already exists`);
      } catch (error) {
        // Label doesn't exist, create it
        const color = getLabelColor(labelName);
        await giteaApiCall<GiteaLabel>(
          client,
          `repos/${owner}/${repo}/labels`,
          {
            method: "POST",
            body: JSON.stringify({
              name: labelName,
              color: color,
              description: `Kaneo ${labelName.replace(":", " ")} label`,
            }),
          },
        );
        console.log(`Created label "${labelName}" with color ${color}`);
      }
    } catch (error) {
      console.error(`Failed to create label "${labelName}":`, error);
    }
  }
}

export async function addLabelsToIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
  projectId: string,
) {
  const client = await createGiteaClient(projectId);
  if (!client) {
    throw new Error("Failed to create Gitea client");
  }

  try {
    // Get current issue labels
    const currentLabels = await giteaApiCall<GiteaLabel[]>(
      client,
      `repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      {
        method: "GET",
      },
    );

    const currentLabelNames = currentLabels.map((label) => label.name);
    const labelsToAdd = labels.filter(
      (label) => !currentLabelNames.includes(label),
    );

    if (labelsToAdd.length > 0) {
      // Add new labels
      await giteaApiCall(
        client,
        `repos/${owner}/${repo}/issues/${issueNumber}/labels`,
        {
          method: "POST",
          body: JSON.stringify({
            labels: labelsToAdd,
          }),
        },
      );
      console.log(
        `Added labels [${labelsToAdd.join(", ")}] to issue #${issueNumber}`,
      );
    }
  } catch (error) {
    console.error(`Failed to add labels to issue #${issueNumber}:`, error);
  }
}

export async function removeLabelFromIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  labelName: string,
  projectId: string,
) {
  const client = await createGiteaClient(projectId);
  if (!client) {
    throw new Error("Failed to create Gitea client");
  }

  try {
    // First check if the issue has this label
    const currentLabels = await giteaApiCall<GiteaLabel[]>(
      client,
      `repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      {
        method: "GET",
      },
    );

    const hasLabel = currentLabels.some((label) => label.name === labelName);

    if (!hasLabel) {
      console.log(
        `Label "${labelName}" does not exist on issue #${issueNumber}, skipping removal`,
      );
      return;
    }

    await giteaApiCall(
      client,
      `repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(labelName)}`,
      {
        method: "DELETE",
      },
    );
    console.log(`Removed label "${labelName}" from issue #${issueNumber}`);
  } catch (error) {
    // Check if it's a "label does not exist" error - if so, just log and continue
    if (
      error instanceof Error &&
      error.message.includes("label does not exist")
    ) {
      console.log(
        `Label "${labelName}" does not exist on issue #${issueNumber}, skipping removal`,
      );
      return;
    }

    console.error(
      `Failed to remove label "${labelName}" from issue #${issueNumber}:`,
      error,
    );
    // Don't throw - continue with the status change even if label removal fails
  }
}

export async function replaceLabelsWithPrefix(
  owner: string,
  repo: string,
  issueNumber: number,
  prefix: string,
  newLabelName: string,
  projectId: string,
) {
  const client = await createGiteaClient(projectId);
  if (!client) {
    throw new Error("Failed to create Gitea client");
  }

  try {
    // Get all current labels on the issue
    const currentLabels = await giteaApiCall<GiteaLabel[]>(
      client,
      `repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      {
        method: "GET",
      },
    );

    // Find all labels with the specified prefix
    const labelsWithPrefix = currentLabels.filter((label) =>
      label.name.startsWith(prefix),
    );

    // Check if we already have exactly the right label and nothing else with this prefix
    const hasOnlyNewLabel =
      labelsWithPrefix.length === 1 &&
      labelsWithPrefix[0]?.name === newLabelName;

    if (hasOnlyNewLabel) {
      console.log(
        `Issue #${issueNumber} already has only "${newLabelName}" label, no changes needed`,
      );
      return;
    }

    // Get all labels that should remain (not matching prefix)
    const labelsToKeep = currentLabels.filter(
      (label) => !label.name.startsWith(prefix),
    );

    // Ensure the new label exists in the repository
    await createGiteaLabels(owner, repo, [newLabelName], projectId);

    // Create the new label set: all non-prefix labels + the new prefix label
    const finalLabels = [
      ...labelsToKeep.map((label) => label.name),
      newLabelName,
    ];

    // Replace all labels on the issue at once using PUT
    await giteaApiCall(
      client,
      `repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      {
        method: "PUT",
        body: JSON.stringify({
          labels: finalLabels,
        }),
      },
    );

    const removedLabels = labelsWithPrefix
      .filter((label) => label.name !== newLabelName)
      .map((label) => label.name);

    if (removedLabels.length > 0) {
      console.log(
        `Removed old ${prefix} labels [${removedLabels.join(", ")}] from issue #${issueNumber}`,
      );
    }

    const wasAdded = !labelsWithPrefix.some(
      (label) => label.name === newLabelName,
    );
    if (wasAdded) {
      console.log(
        `Added new ${prefix} label "${newLabelName}" to issue #${issueNumber}`,
      );
    }

    console.log(
      `Replaced ${prefix} labels with "${newLabelName}" on issue #${issueNumber}`,
    );
  } catch (error) {
    console.error(
      `Failed to replace ${prefix} labels on issue #${issueNumber}:`,
      error,
    );
    // Don't throw - continue even if label replacement fails
  }
}
