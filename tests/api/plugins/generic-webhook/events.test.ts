import { beforeEach, describe, expect, it, vi } from "vitest";
import { postToGenericWebhook } from "../../../../apps/api/src/plugins/generic-webhook/client";
import {
  handleTaskDeleted,
  handleTaskUnassigned,
} from "../../../../apps/api/src/plugins/generic-webhook/events";

const { selectMock, findFirstMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  findFirstMock: vi.fn(),
}));

vi.mock("../../../../apps/api/src/plugins/generic-webhook/client", () => ({
  postToGenericWebhook: vi.fn(),
}));

vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    select: selectMock,
    query: {
      integrationTable: {
        findFirst: findFirstMock,
      },
    },
  },
}));

function selectChain(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

const context = {
  integrationId: "integration-1",
  projectId: "project-1",
  config: {
    webhookUrl: "https://example.com/hooks/kaneo",
  },
};

const enabledContext = {
  ...context,
  config: {
    webhookUrl: "https://example.com/hooks/kaneo",
    events: { taskDeleted: true },
  },
};

const deletedEvent = {
  taskId: "task-1",
  projectId: "project-1",
  userId: "user-1",
  title: "Ship the release",
};

describe("generic webhook event handlers", () => {
  beforeEach(() => {
    vi.mocked(postToGenericWebhook).mockClear();
    selectMock.mockReset();
    findFirstMock.mockReset();
    findFirstMock.mockResolvedValue(undefined);
  });

  it("does not post task.unassigned when taskUnassigned is disabled", async () => {
    await handleTaskUnassigned(
      {
        taskId: "task-1",
        projectId: "project-1",
        userId: "user-1",
        title: "Ship the release",
      },
      context,
    );

    expect(postToGenericWebhook).not.toHaveBeenCalled();
  });

  it("does not post task.deleted when taskDeleted is disabled", async () => {
    await handleTaskDeleted(deletedEvent, context);

    expect(postToGenericWebhook).not.toHaveBeenCalled();
  });

  it("posts a project-scoped task.deleted envelope when enabled", async () => {
    selectMock
      .mockImplementationOnce(() =>
        selectChain([
          { id: "project-1", name: "Roadmap", workspaceId: "workspace-1" },
        ]),
      )
      .mockImplementationOnce(() =>
        selectChain([{ id: "user-1", name: "Andrej" }]),
      );

    await handleTaskDeleted(deletedEvent, enabledContext);

    expect(postToGenericWebhook).toHaveBeenCalledTimes(1);
    const [url, payload] = vi.mocked(postToGenericWebhook).mock.calls[0] ?? [];
    expect(url).toBe("https://example.com/hooks/kaneo");
    expect(payload).toMatchObject({
      event: "task.deleted",
      integration: { type: "generic-webhook" },
      project: { id: "project-1", name: "Roadmap", workspaceId: "workspace-1" },
      task: { id: "task-1", title: "Ship the release" },
      actor: { id: "user-1", name: "Andrej" },
      data: {},
    });
  });

  it("skips task.deleted when the project row no longer exists", async () => {
    selectMock.mockImplementationOnce(() => selectChain([]));

    await handleTaskDeleted(deletedEvent, enabledContext);

    expect(postToGenericWebhook).not.toHaveBeenCalled();
  });
});
