import type { Octokit } from "octokit";

const WEBHOOK_EVENTS = ["push", "pull_request", "issues", "issue_comment"];

export type WebhookRegistration = {
  registered: boolean;
  reason?: string;
};

/**
 * Ensure the repo has a Kaneo webhook pointing at `callbackUrl`, using the
 * project's token. Idempotent: an existing Kaneo hook (matched by URL) is
 * updated with the current secret/events, otherwise a new one is created.
 *
 * Registration needs the token's webhook-admin permission (classic
 * `admin:repo_hook`, or fine-grained "Webhooks" read/write). When that is
 * missing the call fails softly — the caller keeps the stored secret so the
 * webhook can still be added manually.
 */
export async function ensureRepoWebhook(
  octokit: Octokit,
  owner: string,
  repo: string,
  callbackUrl: string,
  secret: string,
): Promise<WebhookRegistration> {
  const config = {
    url: callbackUrl,
    content_type: "json" as const,
    secret,
  };

  try {
    const { data: hooks } = await octokit.rest.repos.listWebhooks({
      owner,
      repo,
      per_page: 100,
    });

    const existing = hooks.find((hook) => hook.config?.url === callbackUrl);

    if (existing) {
      await octokit.rest.repos.updateWebhook({
        owner,
        repo,
        hook_id: existing.id,
        config,
        events: WEBHOOK_EVENTS,
        active: true,
      });
    } else {
      await octokit.rest.repos.createWebhook({
        owner,
        repo,
        config,
        events: WEBHOOK_EVENTS,
        active: true,
      });
    }

    return { registered: true };
  } catch (error) {
    return {
      registered: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
