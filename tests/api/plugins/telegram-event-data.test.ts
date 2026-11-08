import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getTelegramEventData } from "../../../apps/api/src/plugins/telegram/event-data";

const m = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("../../../apps/api/src/database", () => ({
  default: { select: m.select },
}));

function chain(rows: unknown[]) {
  const value: Record<string, unknown> = {};
  value.from = () => value;
  value.innerJoin = () => value;
  value.where = () => value;
  value.limit = async () => rows;
  return value;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getTelegramEventData", () => {
  it("takes the assignee from the event id, not a stale task row", async () => {
    m.select
      .mockReturnValueOnce(
        chain([
          {
            title: "Task",
            number: 1,
            status: "to-do",
            priority: null,
            projectName: "Project",
            projectId: "project",
            workspaceId: "workspace",
            userId: "stale-user",
          },
        ]),
      )
      .mockReturnValueOnce(
        chain([
          { id: "actor", name: "Actor", telegramHandle: null },
          { id: "new-assignee", name: "New", telegramHandle: "new" },
          { id: "stale-user", name: "Stale", telegramHandle: "stale" },
        ]),
      );

    const data = await getTelegramEventData(
      "task",
      "project",
      "actor",
      "new-assignee",
    );

    expect(data).toMatchObject({
      actorName: "Actor",
      assignee: { name: "New", telegramHandle: "new" },
    });
    expect(m.select.mock.calls[0][0]).not.toHaveProperty("userId");
  });
});
