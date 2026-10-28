import { describe, expect, it } from "vite-plus/test";
import { withJsonNotFound } from "./not-found-response";

describe("withJsonNotFound", () => {
  it("turns an empty 404 into the standard JSON error", async () => {
    const response = await withJsonNotFound(
      new Response(null, { status: 404, statusText: "Not Found" }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      message: "Not found",
      code: "NOT_FOUND",
    });
  });

  it("keeps a 404 that already has a body", async () => {
    const original = Response.json(
      { message: "Invitation not found", code: "INVITATION_NOT_FOUND" },
      { status: 404 },
    );

    expect(await withJsonNotFound(original)).toBe(original);
  });

  it("keeps other responses", async () => {
    const original = new Response(null, { status: 204 });

    expect(await withJsonNotFound(original)).toBe(original);
  });
});
