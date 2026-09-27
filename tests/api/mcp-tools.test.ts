import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type McpToolRegistrar,
  registerMcpTools,
} from "../../apps/api/src/mcp/tools";

type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | {
      type: "resource";
      resource: { uri: string; mimeType?: string; blob: string };
    };

type ToolCallback = (args: unknown) => Promise<{
  content: ToolContent[];
  isError?: boolean;
}>;

function binaryResponse(options: {
  bytes?: Uint8Array;
  contentType?: string;
  filename?: string;
  contentLength?: number;
}): Response {
  const headers = new Headers();
  if (options.contentType) {
    headers.set("content-type", options.contentType);
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
  return {
    ok: true,
    status: 200,
    headers,
    arrayBuffer: async () =>
      (options.bytes ?? new Uint8Array()).buffer as ArrayBuffer,
    text: async () => "",
  } as unknown as Response;
}

function collectTools(baseUrl = "http://api.test", assetUrlBase?: string) {
  const tools = new Map<string, ToolCallback>();
  const registrar: McpToolRegistrar = {
    registerTool: (name, _config, callback) => tools.set(name, callback),
  };
  registerMcpTools(registrar, baseUrl, "test-token", assetUrlBase);
  return tools;
}

const tools = collectTools();

function call(name: string, args: unknown = {}) {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool ${name} is not registered`);
  return tool(args);
}

let apiFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  apiFetch = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", apiFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastRequest() {
  const [input, init] = apiFetch.mock.calls.at(-1) as [
    RequestInfo | URL,
    RequestInit | undefined,
  ];
  return {
    url: String(input),
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
    auth: new Headers(init?.headers).get("authorization"),
  };
}

describe("MCP tool catalog", () => {
  it("resolves workspace members", async () => {
    await call("list_workspace_members", { workspaceId: "ws 1" });

    const request = lastRequest();
    expect(request.url).toBe("http://api.test/api/workspace/ws%201/members");
    expect(request.auth).toBe("Bearer test-token");
  });

  it("passes only the search filters that were supplied", async () => {
    await call("search", { q: "login bug" });
    expect(lastRequest().url).toBe("http://api.test/api/search?q=login+bug");

    await call("search", {
      q: "login bug",
      type: "tasks",
      projectId: "p1",
      limit: 5,
    });
    const url = new URL(lastRequest().url);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "login bug",
      type: "tasks",
      projectId: "p1",
      limit: "5",
    });
  });

  it("rejects a search limit above the API maximum", async () => {
    const result = await call("search", { q: "x", limit: 500 });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("lists the columns whose slugs are valid task statuses", async () => {
    await call("list_project_columns", { projectId: "p1" });

    expect(lastRequest().url).toBe("http://api.test/api/column/p1");
  });

  it("deletes a task", async () => {
    await call("delete_task", { taskId: "t1" });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/t1",
      method: "DELETE",
    });
  });

  it("duplicates a task and only sends a title when one is given", async () => {
    await call("duplicate_task", { taskId: "t 1" });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/duplicate/t%201",
      method: "POST",
      body: {},
    });

    await call("duplicate_task", { taskId: "t1", title: "Checklist (copy)" });
    expect(lastRequest().body).toEqual({ title: "Checklist (copy)" });
  });

  it("assigns and unassigns a task", async () => {
    await call("update_task_assignee", { taskId: "t1", userId: "u1" });
    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/assignee/t1",
      method: "PUT",
      body: { userId: "u1" },
    });

    await call("update_task_assignee", { taskId: "t1", userId: null });
    expect(lastRequest().body).toEqual({ userId: null });
  });

  it("rejects an empty assignee id rather than sending it", async () => {
    const result = await call("update_task_assignee", {
      taskId: "t1",
      userId: "",
    });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sets and clears a due date", async () => {
    await call("update_task_due_date", {
      taskId: "t1",
      dueDate: "2026-09-01T10:00:00Z",
    });
    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/due-date/t1",
      method: "PUT",
      body: { dueDate: "2026-09-01T10:00:00Z" },
    });

    await call("update_task_due_date", { taskId: "t1" });
    expect(lastRequest().body).toEqual({});
  });

  it("rejects a due date that is not an ISO date-time", async () => {
    const result = await call("update_task_due_date", {
      taskId: "t1",
      dueDate: "next tuesday",
    });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("reads time entries for a task and by id", async () => {
    await call("list_task_time_entries", { taskId: "t1" });
    expect(lastRequest().url).toBe("http://api.test/api/time-entry/task/t1");

    await call("get_time_entry", { id: "te1" });
    expect(lastRequest().url).toBe("http://api.test/api/time-entry/te1");
  });

  it("creates a running time entry when endTime is omitted", async () => {
    await call("create_time_entry", {
      taskId: "t1",
      startTime: "2026-08-10T09:00:00Z",
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/time-entry",
      method: "POST",
      body: { taskId: "t1", startTime: "2026-08-10T09:00:00Z" },
    });
    expect(lastRequest().body).not.toHaveProperty("endTime");
  });

  it("updates a time entry", async () => {
    await call("update_time_entry", {
      id: "te1",
      startTime: "2026-08-10T09:00:00Z",
      endTime: "2026-08-10T10:30:00Z",
      description: "pairing",
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/time-entry/te1",
      method: "PUT",
      body: {
        startTime: "2026-08-10T09:00:00Z",
        endTime: "2026-08-10T10:30:00Z",
        description: "pairing",
      },
    });
  });

  it("reads task activity and notifications", async () => {
    await call("list_task_activity", { taskId: "t1" });
    expect(lastRequest().url).toBe("http://api.test/api/activity/t1");

    await call("list_notifications");
    expect(lastRequest().url).toBe("http://api.test/api/notification");
  });

  it("surfaces an API failure as a tool error", async () => {
    apiFetch.mockResolvedValueOnce(
      Response.json({ message: "Task not found" }, { status: 404 }),
    );

    const result = await call("delete_task", { taskId: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Task not found");
  });

  it("downloads an image asset as image content", async () => {
    apiFetch.mockResolvedValueOnce(
      binaryResponse({
        bytes: new Uint8Array([104, 105]),
        contentType: "image/png",
        filename: "pic.png",
        contentLength: 2,
      }),
    );

    const result = await call("get_asset", { assetId: "abc123" });

    const request = lastRequest();
    expect(request.url).toBe("http://api.test/api/asset/abc123");
    expect(request.auth).toBe("Bearer test-token");
    expect(result.isError).toBe(false);
    expect(result.content[0]).toEqual({
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
    expect(result.content[1]).toEqual({
      type: "image",
      data: "aGk=",
      mimeType: "image/png",
    });
  });

  it("extracts the asset id from a full /api/asset URL", async () => {
    apiFetch.mockResolvedValueOnce(
      binaryResponse({ bytes: new Uint8Array([1]), contentType: "image/png" }),
    );

    await call("get_asset", { assetId: "https://kaneo.test/api/asset/xyz789" });

    expect(lastRequest().url).toBe("http://api.test/api/asset/xyz789");
  });

  it("returns a non-image asset as an embedded resource", async () => {
    apiFetch.mockResolvedValueOnce(
      binaryResponse({
        bytes: new Uint8Array([10, 20, 30]),
        contentType: "application/pdf",
        filename: "report.pdf",
      }),
    );

    const result = await call("get_asset", { assetId: "doc1" });

    expect(result.content[1]).toEqual({
      type: "resource",
      resource: {
        uri: "http://api.test/api/asset/doc1",
        mimeType: "application/pdf",
        blob: Buffer.from([10, 20, 30]).toString("base64"),
      },
    });
  });

  it("reports a missing asset", async () => {
    apiFetch.mockResolvedValueOnce(
      Response.json({ message: "Asset not found" }, { status: 404 }),
    );

    const result = await call("get_asset", { assetId: "gone" });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: "text",
      text: JSON.stringify({ error: "Asset gone not found" }, null, 2),
    });
  });

  it("rejects a malformed asset reference before making a request", async () => {
    const result = await call("get_asset", {
      assetId: "https://kaneo.test/not-an-asset",
    });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("shows the public API origin, not the internal request origin", async () => {
    const publicTools = collectTools(
      "http://internal.test",
      "https://public.test",
    );
    apiFetch.mockResolvedValueOnce(
      binaryResponse({
        bytes: new Uint8Array([1]),
        contentType: "application/pdf",
      }),
    );

    const callback = publicTools.get("get_asset");
    if (!callback) throw new Error("get_asset is not registered");
    const result = await callback({ assetId: "doc1" });

    expect(result.content[0]).toEqual({
      type: "text",
      text: JSON.stringify(
        {
          id: "doc1",
          filename: null,
          mimeType: "application/pdf",
          size: 1,
          url: "https://public.test/api/asset/doc1",
        },
        null,
        2,
      ),
    });
    expect(result.content[1]).toEqual({
      type: "resource",
      resource: {
        uri: "https://public.test/api/asset/doc1",
        mimeType: "application/pdf",
        blob: Buffer.from([1]).toString("base64"),
      },
    });
  });

  it("refuses to inline an asset larger than the limit", async () => {
    apiFetch.mockResolvedValueOnce(
      binaryResponse({
        bytes: new Uint8Array([1]),
        contentType: "image/png",
        contentLength: 10 * 1024 * 1024 + 1,
      }),
    );

    const result = await call("get_asset", { assetId: "big" });

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const [content] = result.content;
    expect(content).toMatchObject({ type: "text" });
    expect(content?.type === "text" ? content.text : "").toContain(
      "over the 10.0MB MCP limit",
    );
  });
});
