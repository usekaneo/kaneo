import { describe, expect, it, vi } from "vitest";
import { registerTools } from "./register.js";

type RegisteredTool = {
  name: string;
  config: { inputSchema?: { parse: (args: unknown) => unknown } };
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
};

function createServerMock() {
  const tools = new Map<string, RegisteredTool>();

  return {
    server: {
      registerTool: vi.fn(
        (
          name: string,
          config: RegisteredTool["config"],
          handler: RegisteredTool["handler"],
        ) => {
          tools.set(name, { name, config, handler });
        },
      ),
    },
    tools,
  };
}

describe("registerTools", () => {
  it("registers the MCP tools", () => {
    const { server } = createServerMock();
    const client = { json: vi.fn() };

    registerTools(server as never, { client: client as never });

    expect(server.registerTool).toHaveBeenCalled();
    expect(server.registerTool).toHaveBeenCalledWith(
      "whoami",
      expect.any(Object),
      expect.any(Function),
    );
    expect(server.registerTool).toHaveBeenCalledWith(
      "update_task",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("builds the expected query string for list_tasks", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn().mockResolvedValue([{ id: "task-1" }]),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("list_tasks")?.handler({
      projectId: "project 1",
      status: "open",
      page: 2,
      sortOrder: "desc",
    });

    expect(client.json).toHaveBeenCalledWith(
      "/api/task/tasks/project%201?status=open&page=2&sortOrder=desc",
      { method: "GET" },
    );
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify([{ id: "task-1" }], null, 2),
        },
      ],
      isError: false,
    });
  });

  it("fetches the current task and sends a full body for update_task", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi
        .fn()
        .mockResolvedValueOnce({
          title: "Draft spec",
          description: "Write docs",
          status: "open",
          priority: "medium",
          projectId: "project-1",
          position: 4,
        })
        .mockResolvedValueOnce({ id: "task-1", status: "done" }),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("update_task")?.handler({
      taskId: "task-1",
      status: "done",
    });

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/task/task-1", {
      method: "GET",
    });
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/task/task-1", {
      method: "PUT",
      body: JSON.stringify({
        title: "Draft spec",
        description: "Write docs",
        status: "done",
        priority: "medium",
        projectId: "project-1",
        position: 4,
      }),
    });
    expect(result?.isError).toBe(false);
  });

  it("returns an MCP error result when the client request fails", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn().mockRejectedValue(new Error("boom")),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("whoami")?.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: "boom" }, null, 2),
        },
      ],
      isError: true,
    });
  });

  it("validates label colors as hex values", () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn() };

    registerTools(server as never, { client: client as never });

    const schema = tools.get("create_label")?.config.inputSchema;
    expect(schema).toBeDefined();
    expect(() =>
      schema?.parse({
        name: "Bug",
        color: "red",
        workspaceId: "workspace-1",
      }),
    ).toThrow(/hex color/i);
  });

  it("validates task date filters as ISO datetimes with timezone", () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn() };

    registerTools(server as never, { client: client as never });

    const schema = tools.get("list_tasks")?.config.inputSchema;
    expect(schema).toBeDefined();
    expect(() =>
      schema?.parse({
        projectId: "project-1",
        dueBefore: "2026-04-04",
      }),
    ).toThrow();
  });
});
