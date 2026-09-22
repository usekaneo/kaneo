import { afterEach, describe, expect, it, vi } from "vitest";
import { handleTaskCreated } from "../../../apps/api/src/plugins/telegram/events";

const m = vi.hoisted(() => ({ select: vi.fn(), send: vi.fn() }));
vi.mock("../../../apps/api/src/database", () => ({
  default: { select: m.select },
}));
vi.mock("../../../apps/api/src/plugins/telegram/client", () => ({
  postToTelegram: m.send,
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

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
const token = `12345678:${"x".repeat(35)}`;
describe("Telegram logging", () => {
  it("does not log secret-bearing invalid configuration", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await handleTaskCreated(event, {
      integrationId: "integration",
      projectId: "project",
      config: { botToken: token, chatId: "" },
    });
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(token);
    expect(JSON.stringify(log.mock.calls)).not.toContain("botToken");
    expect(m.select).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
  it("discards unknown errors with token-bearing causes", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    function chain(rows: unknown[]) {
      const value = {
        from: () => value,
        innerJoin: () => value,
        where: () => value,
        limit: async () => rows,
      };
      return value;
    }
    m.select
      .mockReturnValueOnce(
        chain([
          {
            title: "Task",
            number: 1,
            status: "to-do",
            priority: "low",
            projectName: "Project",
            workspaceId: "workspace",
            projectId: "project",
          },
        ]),
      )
      .mockReturnValueOnce(chain([{ name: "User" }]));
    m.send.mockRejectedValue(
      new Error(`Failed https://api.telegram.org/bot${token}`, {
        cause: { token },
      }),
    );
    await handleTaskCreated(event, {
      integrationId: "integration",
      projectId: "project",
      config: { botToken: token, chatId: "chat" },
    });
    expect(m.send).toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(token);
    expect(JSON.stringify(log.mock.calls)).toContain("Outbound request failed");
  });
});
