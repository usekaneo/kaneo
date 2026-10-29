import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { OutboundRequestError } from "../../utils/outbound-request";
import { handleTaskCreated } from "./events";

const mocks = vi.hoisted(() => ({ select: vi.fn(), post: vi.fn() }));

vi.mock("../../database", () => ({ default: { select: mocks.select } }));
vi.mock("./client", () => ({
  postToDiscord: mocks.post,
  sanitizeDiscordContent: (value: string) => value,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

function selectChain(rows: unknown[]) {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    limit: async () => rows,
  };
  return chain;
}

const event = {
  taskId: "task",
  projectId: "project",
  userId: "user",
  title: "Task",
  description: null,
  priority: null,
  status: "to-do",
  number: 1,
};

describe("Discord delivery error logging", () => {
  it.each(["unknown", "http"])(
    "omits secret-bearing configuration and %s error details",
    async (kind) => {
      const webhookUrl =
        "https://discord.com/api/webhooks/private-webhook-id/ab-private-token-wxyz?key=private-query";
      const error =
        kind === "http"
          ? new OutboundRequestError("http", 503)
          : new Error(`Failed request to ${webhookUrl}`, {
              cause: new Error("private-cause"),
            });
      // Console formatting includes non-enumerable Error messages and causes.
      // JSON.stringify alone would miss those disclosures.
      error.stack = `private-stack ${webhookUrl}`;
      mocks.post.mockRejectedValueOnce(error);
      mocks.select
        .mockReturnValueOnce(
          selectChain([
            {
              title: "Task",
              number: 1,
              status: "to-do",
              priority: "low",
              columnName: "To do",
              projectName: "Project",
              workspaceId: "workspace",
              projectId: "project",
            },
          ]),
        )
        .mockReturnValueOnce(selectChain([{ name: "User" }]));
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        handleTaskCreated(event, {
          integrationId: "integration",
          projectId: "project",
          config: { webhookUrl, channelName: webhookUrl },
        }),
      ).resolves.toBeUndefined();

      expect(mocks.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({ content: "New task created: #1 Task" }),
      );
      expect(log).toHaveBeenCalledExactlyOnceWith(
        "sendDiscordMessage postToDiscord failed",
        {
          error:
            kind === "http"
              ? "Outbound request failed: http (HTTP 503)"
              : "Outbound request failed",
        },
      );
      const output = inspect(log.mock.calls, { depth: null });
      for (const secret of [
        "private-webhook-id",
        "private-token",
        "private-query",
        "private-cause",
        "private-stack",
        "wxyz",
      ]) {
        expect(output).not.toContain(secret);
      }
    },
  );
});
