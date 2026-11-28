import { describe, expect, it, vi } from "vite-plus/test";
import { HttpError, isUnauthorizedError } from "@/lib/http-error";
import { PluginApiError } from "../plugin-api-error";
import { createApiClient } from "./create-api-client";

function respond(status: number, body: string, statusText = "") {
  return vi.fn<typeof fetch>(
    async () => new Response(body || null, { status, statusText }),
  );
}

describe("createApiClient", () => {
  it("sends JSON with credentials and the configured headers", async () => {
    const fetchMock = respond(200, JSON.stringify({ value: 40 }));
    const client = createApiClient({
      baseUrl: "https://api.test/api/plugins/progress",
      headers: { "X-Kaneo-Window-Id": "window-1" },
      fetch: fetchMock,
    });

    await expect(client.put("/tasks/t1", { value: 40 })).resolves.toEqual({
      value: 40,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/plugins/progress/tasks/t1",
      {
        method: "PUT",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Kaneo-Window-Id": "window-1",
        },
        body: JSON.stringify({ value: 40 }),
      },
    );
  });

  it("omits the body and content type for reads", async () => {
    const fetchMock = respond(200, "[]");
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock });

    await client.get("items");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toEqual({ Accept: "application/json" });
  });

  it("returns undefined for empty responses and text for non JSON", async () => {
    const empty = createApiClient({ baseUrl: "/api", fetch: respond(204, "") });
    const text = createApiClient({
      baseUrl: "/api",
      fetch: respond(200, "ok"),
    });

    await expect(empty.delete("items/1")).resolves.toBeUndefined();
    await expect(text.get("health")).resolves.toBe("ok");
  });

  it("carries the status and the server message from a JSON error", async () => {
    const client = createApiClient({
      baseUrl: "/api",
      fetch: respond(
        400,
        JSON.stringify({
          message: "Invalid settings",
          errors: { limit: "Must be at most 10", ignored: 3 },
        }),
      ),
    });

    const error = await client.post("settings", {}).catch((caught) => caught);
    expect(error).toBeInstanceOf(PluginApiError);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      status: 400,
      message: "Invalid settings",
      fieldErrors: { limit: "Must be at most 10" },
    });
  });

  it("falls back to the text body, then the status text", async () => {
    const textError = createApiClient({
      baseUrl: "/api",
      fetch: respond(403, "Plugin is not enabled in this workspace"),
    });
    const emptyError = createApiClient({
      baseUrl: "/api",
      fetch: respond(502, "", "Bad Gateway"),
    });

    await expect(textError.get("x")).rejects.toMatchObject({
      status: 403,
      message: "Plugin is not enabled in this workspace",
    });
    await expect(emptyError.get("x")).rejects.toMatchObject({
      status: 502,
      message: "Bad Gateway",
    });
  });

  it("keeps 401 errors recognisable to the session handler", async () => {
    const client = createApiClient({
      baseUrl: "/api",
      fetch: respond(401, JSON.stringify({ message: "Unauthorized" })),
    });

    const error = await client.get("x").catch((caught) => caught);
    expect(isUnauthorizedError(error)).toBe(true);
  });
});
