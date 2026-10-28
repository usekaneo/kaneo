import { marker, ownsLabel, scanComment } from "./comment.mjs";
import { policy } from "./policy.mjs";

async function ensureLabel(github, root) {
  const path = `${root}/labels/${policy.label}`;
  if (await github.request(path, { allowMissing: true })) return;
  try {
    await github.request(`${root}/labels`, {
      method: "POST",
      body: {
        name: policy.label,
        color: "b08968",
        description:
          "Automated AI-comment hint; may be wrong and can be ignored.",
      },
    });
  } catch (error) {
    // Different PRs can try to create the repository label concurrently.
    if (
      error.status !== 422 ||
      !(await github.request(path, { allowMissing: true }))
    ) {
      throw error;
    }
  }
}

export async function publishScan(github, pull, result) {
  const root = `/repos/${github.repository}`;
  const issue = `${root}/issues/${pull.number}`;
  const comments = await github.list(`${issue}/comments`, 20);
  const comment = comments.find(
    (entry) =>
      entry.user?.login === "github-actions[bot]" &&
      entry.user?.type === "Bot" &&
      entry.body?.startsWith(marker),
  );

  // A scan for an old head or diff base must not publish over a newer revision.
  const current = await github.request(`${root}/pulls/${pull.number}`);
  if (
    current.state !== "open" ||
    current.head.sha !== pull.head.sha ||
    current.base.sha !== pull.base.sha
  ) {
    return "stale";
  }

  const labeled = current.labels.some((label) => label.name === policy.label);
  const owned = ownsLabel(comment) || (result.flagged && !labeled);
  if (!result.flagged && !comment) return "clear";

  if (result.flagged && !labeled) {
    await ensureLabel(github, root);
  } else if (!result.flagged && labeled && owned) {
    await github.request(`${issue}/labels/${policy.label}`, {
      method: "DELETE",
    });
  }

  const body = scanComment(result.flagged, result.flagged && owned);
  // Record ownership before adding a label so a retry can repair either write.
  if (!comment) {
    await github.request(`${issue}/comments`, {
      method: "POST",
      body: { body },
    });
  } else if (comment.body !== body) {
    await github.request(`${root}/issues/comments/${comment.id}`, {
      method: "PATCH",
      body: { body },
    });
  }

  if (result.flagged && !labeled) {
    await github.request(`${issue}/labels`, {
      method: "POST",
      body: { labels: [policy.label] },
    });
  }
  return result.flagged ? "flagged" : "clear";
}
