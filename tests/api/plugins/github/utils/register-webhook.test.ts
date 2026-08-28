import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureRepoWebhook } from "../../../../../apps/api/src/plugins/github/utils/register-webhook";

const listWebhooks = vi.fn();
const createWebhook = vi.fn();
const updateWebhook = vi.fn();

// Minimal Octokit shape; the util only touches these three methods.
const octokit = {
  rest: { repos: { listWebhooks, createWebhook, updateWebhook } },
} as unknown as Parameters<typeof ensureRepoWebhook>[0];

const url = "https://kaneo.example.com/github-integration/webhook";

beforeEach(() => {
  vi.clearAllMocks();
  listWebhooks.mockResolvedValue({ data: [] });
  createWebhook.mockResolvedValue({ data: { id: 1 } });
  updateWebhook.mockResolvedValue({ data: { id: 1 } });
});

describe("ensureRepoWebhook", () => {
  it("creates a hook when none points at the callback URL", async () => {
    const result = await ensureRepoWebhook(octokit, "o", "r", url, "secret");

    expect(result).toEqual({ registered: true });
    expect(createWebhook).toHaveBeenCalledTimes(1);
    expect(createWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "o",
        repo: "r",
        config: { url, content_type: "json", secret: "secret" },
        events: ["push", "pull_request", "issues", "issue_comment"],
        active: true,
      }),
    );
    expect(updateWebhook).not.toHaveBeenCalled();
  });

  it("updates the existing Kaneo hook instead of duplicating it", async () => {
    listWebhooks.mockResolvedValue({
      data: [{ id: 42, config: { url } }],
    });

    const result = await ensureRepoWebhook(octokit, "o", "r", url, "secret2");

    expect(result).toEqual({ registered: true });
    expect(updateWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ hook_id: 42, active: true }),
    );
    expect(createWebhook).not.toHaveBeenCalled();
  });

  it("fails softly when the token lacks webhook permission", async () => {
    listWebhooks.mockRejectedValue(new Error("Resource not accessible"));

    const result = await ensureRepoWebhook(octokit, "o", "r", url, "secret");

    expect(result.registered).toBe(false);
    expect(result.reason).toContain("Resource not accessible");
  });
});
