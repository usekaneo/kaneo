import { describe, expect, it, vi } from "vite-plus/test";
import { registerTools } from "./register.js";

type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | {
      type: "resource";
      resource: { uri: string; mimeType?: string; blob: string };
    };

type RegisteredTool = {
  name: string;
  config: { inputSchema?: { parse: (args: unknown) => unknown } };
  handler: (args: Record<string, unknown>) => Promise<{
    content: ToolContent[];
    isError?: boolean;
  }>;
};

function bodyFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function binaryResponse(options: {
  bytes?: Uint8Array;
  chunks?: Uint8Array[];
  contentType?: string;
  assetMimeType?: string;
  filename?: string;
  contentLength?: number;
}): Response {
  const headers = new Headers();
  if (options.contentType) {
    headers.set("content-type", options.contentType);
  }
  if (options.assetMimeType) {
    headers.set("x-asset-mime-type", options.assetMimeType);
  }
  if (options.filename) {
    headers.set(
      "content-disposition",
      `inline; filename="${options.filename}"`,
    );
  }
  if (options.contentLength !== undefined) {
    headers.set("content-length", String(options.contentLength));
  }
  const chunks = options.chunks ?? [options.bytes ?? new Uint8Array()];
  return {
    ok: true,
    status: 200,
    headers,
    body: bodyFromChunks(chunks),
    text: async () => "",
  } as unknown as Response;
}

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

  it("uses the API-key current-user endpoint for whoami", async () => {
    const { server, tools } = createServerMock();
    const client = {
      usingApiKey: true,
      json: vi.fn().mockResolvedValue({
        id: "user-1",
        name: "Mohiuddin",
      }),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("whoami")?.handler({});

    expect(client.json).toHaveBeenCalledWith("/api/user/me", {
      method: "GET",
    });
    expect(result?.isError).toBe(false);
    expect(result?.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({ id: "user-1", name: "Mohiuddin" }, null, 2),
      },
    ]);
  });

  it("uses the session endpoint for whoami with device authentication", async () => {
    const { server, tools } = createServerMock();
    const client = {
      usingApiKey: false,
      json: vi.fn().mockResolvedValue({
        user: { id: "user-1" },
        session: { id: "session-1" },
      }),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("whoami")?.handler({});

    expect(client.json).toHaveBeenCalledWith("/api/auth/get-session", {
      method: "GET",
    });
    expect(result?.isError).toBe(false);
    expect(result?.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(
          { user: { id: "user-1" }, session: { id: "session-1" } },
          null,
          2,
        ),
      },
    ]);
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
      relatedPage: 3,
      sortOrder: "desc",
    });

    expect(client.json).toHaveBeenCalledWith(
      "/api/task/tasks/project%201?status=open&page=2&relatedPage=3&sortOrder=desc",
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

  it("gets one task by ticket ID with an optional workspace", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn().mockResolvedValue({ id: "task-1", number: 12 }),
    };
    registerTools(server as never, { client: client as never });

    const tool = tools.get("get_task_by_ticket_id");
    expect(tool).toBeDefined();
    await tool?.handler({ ticketId: "KAN-12" });
    await tool?.handler({ ticketId: "KAN-12", workspaceId: "workspace 1" });
    await tool?.handler({ ticketId: "KAN-12", projectId: "project 1" });

    expect(client.json).toHaveBeenNthCalledWith(
      1,
      "/api/task/by-ticket-id/KAN-12",
      { method: "GET" },
    );
    expect(client.json).toHaveBeenNthCalledWith(
      2,
      "/api/task/by-ticket-id/KAN-12?workspaceId=workspace+1",
      { method: "GET" },
    );
    expect(client.json).toHaveBeenNthCalledWith(
      3,
      "/api/task/by-ticket-id/KAN-12?projectId=project+1",
      { method: "GET" },
    );
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
    const putCall = client.json.mock.calls[1];
    expect(putCall?.[0]).toBe("/api/task/task-1");
    const putBody = JSON.parse(
      String((putCall?.[1] as { body?: string })?.body ?? "{}"),
    );
    expect(putBody).toEqual(
      expect.objectContaining({
        title: "Draft spec",
        description: "Write docs",
        status: "done",
        priority: "medium",
        projectId: "project-1",
        position: 4,
      }),
    );
    expect(result?.isError).toBe(false);
  });

  it("fetches the current project and sends a full body for update_project", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi
        .fn()
        .mockResolvedValueOnce({
          name: "Roadmap",
          slug: "roadmap",
        })
        .mockResolvedValueOnce({ id: "project-1", name: "Roadmap v2" }),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("update_project")?.handler({
      id: "project-1",
      name: "Roadmap v2",
    });

    expect(client.json).toHaveBeenNthCalledWith(1, "/api/project/project-1", {
      method: "GET",
    });
    const putCall = client.json.mock.calls[1];
    expect(putCall?.[0]).toBe("/api/project/project-1");
    const putBody = JSON.parse(
      String((putCall?.[1] as { body?: string })?.body ?? "{}"),
    );
    expect(putBody).toEqual({
      name: "Roadmap v2",
      icon: "Layout",
      slug: "roadmap",
      description: "",
      isPublic: false,
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

  it("creates a task relation with the expected body", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn().mockResolvedValue({ id: "rel-1", relationType: "blocks" }),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("create_task_relation")?.handler({
      sourceTaskId: "task-1",
      targetTaskId: "task-2",
      relationType: "blocks",
    });

    expect(client.json).toHaveBeenCalledWith("/api/task-relation", {
      method: "POST",
      body: JSON.stringify({
        sourceTaskId: "task-1",
        targetTaskId: "task-2",
        relationType: "blocks",
      }),
    });
    expect(result?.isError).toBe(false);
  });

  it("validates relationType for create_task_relation", () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn() };

    registerTools(server as never, { client: client as never });

    const schema = tools.get("create_task_relation")?.config.inputSchema;
    expect(schema).toBeDefined();
    expect(() =>
      schema?.parse({
        sourceTaskId: "task-1",
        targetTaskId: "task-2",
        relationType: "duplicate",
      }),
    ).toThrow();
  });

  it("gets task relations by task id", async () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn().mockResolvedValue([]) };

    registerTools(server as never, { client: client as never });

    await tools.get("get_task_relations")?.handler({ taskId: "task 1" });

    expect(client.json).toHaveBeenCalledWith("/api/task-relation/task%201", {
      method: "GET",
    });
  });

  it("deletes a task relation by id", async () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn().mockResolvedValue({}) };

    registerTools(server as never, { client: client as never });

    await tools.get("delete_task_relation")?.handler({ id: "rel-1" });

    expect(client.json).toHaveBeenCalledWith("/api/task-relation/rel-1", {
      method: "DELETE",
    });
  });

  it("deletes a task-associated label without an obsolete preflight", async () => {
    const { server, tools } = createServerMock();
    const client = { json: vi.fn().mockResolvedValue({ id: "label-1" }) };
    registerTools(server as never, { client: client as never });
    const result = await tools.get("delete_label")?.handler({ id: "label-1" });
    expect(client.json).toHaveBeenCalledExactlyOnceWith("/api/label/label-1", {
      method: "DELETE",
      signal: expect.any(AbortSignal),
    });
    expect(result?.isError).toBe(false);
  });

  it("resumes workspace label deletion until the API completes it", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi
        .fn()
        .mockResolvedValueOnce({
          id: "label-1",
          taskId: null,
          pendingDeletion: true,
        })
        .mockResolvedValueOnce({ id: "label-1", taskId: null }),
    };
    registerTools(server as never, { client: client as never });
    const result = await tools.get("delete_label")?.handler({ id: "label-1" });
    expect(result?.isError).toBe(false);
    expect(client.json).toHaveBeenCalledTimes(2);
    expect(client.json).toHaveBeenNthCalledWith(2, "/api/label/label-1", {
      method: "DELETE",
      signal: expect.any(AbortSignal),
    });
  });

  it("downloads an asset by bare id", async () => {
    const { server, tools } = createServerMock();
    const client = {
      baseUrl: "http://api.test",
      raw: vi.fn().mockResolvedValue(
        binaryResponse({
          bytes: new Uint8Array([104, 105]),
          contentType: "image/png",
          filename: "pic.png",
          contentLength: 2,
        }),
      ),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("get_asset")?.handler({ assetId: "abc123" });

    expect(client.raw).toHaveBeenCalledWith("/api/asset/abc123", {
      method: "GET",
    });
    expect(result?.isError).toBe(false);
    expect(result?.content[0]).toEqual({
      type: "text",
      text: JSON.stringify(
        {
          id: "abc123",
          filename: "pic.png",
          mimeType: "image/png",
          size: 2,
          url: "http://api.test/api/asset/abc123",
        },
        null,
        2,
      ),
    });
    expect(result?.content[1]).toEqual({
      type: "image",
      data: "aGk=",
      mimeType: "image/png",
    });
  });

  it("extracts the asset id from a full /api/asset URL", async () => {
    const { server, tools } = createServerMock();
    const client = {
      baseUrl: "http://api.test",
      raw: vi.fn().mockResolvedValue(
        binaryResponse({
          bytes: new Uint8Array([1]),
          contentType: "image/png",
        }),
      ),
    };

    registerTools(server as never, { client: client as never });

    await tools
      .get("get_asset")
      ?.handler({ assetId: "https://kaneo.test/api/asset/xyz789" });

    expect(client.raw).toHaveBeenCalledWith("/api/asset/xyz789", {
      method: "GET",
    });
  });

  it("ignores punctuation wrapping a pasted asset URL", async () => {
    const { server, tools } = createServerMock();
    const client = {
      baseUrl: "http://api.test",
      raw: vi.fn().mockResolvedValue(
        binaryResponse({
          bytes: new Uint8Array([1]),
          contentType: "image/png",
        }),
      ),
    };

    registerTools(server as never, { client: client as never });

    await tools
      .get("get_asset")
      ?.handler({ assetId: "![Image](https://kaneo.test/api/asset/xyz789)" });

    expect(client.raw).toHaveBeenCalledWith("/api/asset/xyz789", {
      method: "GET",
    });
  });

  it("returns a non-image asset as an embedded resource", async () => {
    const { server, tools } = createServerMock();
    const client = {
      baseUrl: "http://api.test",
      raw: vi.fn().mockResolvedValue(
        binaryResponse({
          bytes: new Uint8Array([10, 20, 30]),
          contentType: "application/octet-stream",
          assetMimeType: "application/pdf",
          filename: "report.pdf",
        }),
      ),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("get_asset")?.handler({ assetId: "doc1" });

    expect(result?.content[0]).toEqual({
      type: "text",
      text: JSON.stringify(
        {
          id: "doc1",
          filename: "report.pdf",
          mimeType: "application/pdf",
          size: 3,
          url: "http://api.test/api/asset/doc1",
        },
        null,
        2,
      ),
    });
    expect(result?.content[1]).toEqual({
      type: "resource",
      resource: {
        uri: "http://api.test/api/asset/doc1",
        mimeType: "application/pdf",
        blob: Buffer.from([10, 20, 30]).toString("base64"),
      },
    });
  });

  it("returns image types hosts may reject as embedded resources", async () => {
    const { server, tools } = createServerMock();
    const client = {
      baseUrl: "http://api.test",
      raw: vi.fn().mockResolvedValue(
        binaryResponse({
          bytes: new Uint8Array([10, 20, 30]),
          contentType: "image/heic",
          filename: "photo.heic",
        }),
      ),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("get_asset")?.handler({ assetId: "heic1" });

    expect(result?.content[1]).toEqual({
      type: "resource",
      resource: {
        uri: "http://api.test/api/asset/heic1",
        mimeType: "image/heic",
        blob: Buffer.from([10, 20, 30]).toString("base64"),
      },
    });
  });

  it("reports a missing asset without leaking the response body", async () => {
    const { server, tools } = createServerMock();
    const client = {
      baseUrl: "http://api.test",
      raw: vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () => JSON.stringify({ message: "Asset not found" }),
      } as unknown as Response),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("get_asset")?.handler({ assetId: "gone" });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]).toEqual({
      type: "text",
      text: JSON.stringify({ error: "Asset gone not found" }, null, 2),
    });
  });

  it("rejects a malformed asset reference before making a request", async () => {
    const { server, tools } = createServerMock();
    const client = { baseUrl: "http://api.test", raw: vi.fn() };

    registerTools(server as never, { client: client as never });

    const result = await tools
      .get("get_asset")
      ?.handler({ assetId: "https://kaneo.test/not-an-asset" });

    expect(result?.isError).toBe(true);
    expect(client.raw).not.toHaveBeenCalled();
  });

  it("refuses to inline an asset larger than the limit", async () => {
    const { server, tools } = createServerMock();
    const client = {
      baseUrl: "http://api.test",
      raw: vi.fn().mockResolvedValue(
        binaryResponse({
          bytes: new Uint8Array([1]),
          contentType: "image/png",
          contentLength: 10 * 1024 * 1024 + 1,
        }),
      ),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("get_asset")?.handler({ assetId: "big" });

    expect(result?.isError).toBe(true);
    expect(result?.content).toHaveLength(1);
    const [content] = result?.content ?? [];
    expect(content).toMatchObject({ type: "text" });
    const text = content?.type === "text" ? content.text : "";
    expect(text).toContain("over the 10.0MB MCP limit");
    expect(text).toContain("http://api.test/api/asset/big");
    expect(text).toContain("API key or session token");
    expect(text).not.toContain("KANEO_API_KEY");
  });

  it("cancels the download stream when content-length exceeds the limit", async () => {
    const { server, tools } = createServerMock();
    const cancel = vi.fn();
    const client = {
      baseUrl: "http://api.test",
      raw: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-length": String(10 * 1024 * 1024 + 1),
        }),
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([1]));
          },
          cancel,
        }),
        text: async () => "",
      } as unknown as Response),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools.get("get_asset")?.handler({ assetId: "big" });

    expect(result?.isError).toBe(true);
    expect(cancel).toHaveBeenCalled();
  });

  it("refuses an oversized streamed asset without a declared length", async () => {
    const { server, tools } = createServerMock();
    const client = {
      baseUrl: "http://api.test",
      raw: vi.fn().mockResolvedValue(
        binaryResponse({
          chunks: [
            new Uint8Array(6 * 1024 * 1024),
            new Uint8Array(5 * 1024 * 1024),
          ],
          contentType: "image/png",
        }),
      ),
    };

    registerTools(server as never, { client: client as never });

    const result = await tools
      .get("get_asset")
      ?.handler({ assetId: "big-stream" });

    expect(result?.isError).toBe(true);
    expect(result?.content).toHaveLength(1);
    const [content] = result?.content ?? [];
    expect(content).toMatchObject({ type: "text" });
    const text = content?.type === "text" ? content.text : "";
    expect(text).toContain("over the 10.0MB MCP limit");
    expect(text).toContain("http://api.test/api/asset/big-stream");
    expect(text).not.toContain("KANEO_API_KEY");
  });

  it("returns saved progress when the overall deletion deadline expires", async () => {
    const { server, tools } = createServerMock();
    const controller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    const progress = { id: "large", pendingDeletion: true };
    const client = {
      json: vi
        .fn()
        .mockResolvedValueOnce(progress)
        .mockImplementationOnce(async () => {
          controller.abort();
          throw new DOMException("Timed out", "TimeoutError");
        }),
    };
    try {
      registerTools(server as never, { client: client as never });
      const result = await tools.get("delete_label")?.handler({ id: "large" });
      expect(timeout).toHaveBeenCalledWith(10_000);
      expect(result?.isError).toBe(false);
      expect(client.json).toHaveBeenCalledTimes(2);
      expect(client.json).toHaveBeenLastCalledWith("/api/label/large", {
        method: "DELETE",
        signal: controller.signal,
      });
      expect(result?.content).toEqual([
        expect.objectContaining({
          text: expect.stringContaining('"pendingDeletion": true'),
        }),
      ]);
    } finally {
      timeout.mockRestore();
    }
  });

  it("returns resumable progress when a cascade exceeds one tool call", async () => {
    const { server, tools } = createServerMock();
    const client = {
      json: vi.fn().mockResolvedValue({ pendingDeletion: true }),
    };
    registerTools(server as never, { client: client as never });
    const result = await tools.get("delete_label")?.handler({ id: "large" });
    expect(result?.isError).toBe(false);
    expect(client.json).toHaveBeenCalledTimes(100);
    expect(result?.content).toEqual([
      expect.objectContaining({
        text: expect.stringContaining('"pendingDeletion": true'),
      }),
    ]);
  });
});
