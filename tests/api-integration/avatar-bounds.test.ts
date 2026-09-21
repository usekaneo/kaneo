import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  MAX_AVATAR_BYTES,
  MAX_AVATAR_INPUT_CHARS,
  MAX_AVATAR_REQUEST_BYTES,
} from "../../apps/api/src/user/avatar";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);
async function fixture() {
  const member = await createWorkspaceMember({ role: "viewer" });
  mockAuthenticatedSession(member.user);
  return createApp().app;
}
describe("avatar request bounds", () => {
  it("rejects excessive declared length before reading the body", async () => {
    const app = await fixture();
    const cancel = vi.fn();
    const response = await app.request(
      new Request("http://localhost/api/user/avatar", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "content-length": String(MAX_AVATAR_REQUEST_BYTES + 1),
        },
        body: new ReadableStream({ cancel }),
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(await db.select().from(schema.userAvatarTable)).toHaveLength(0);
  });
  it.each([undefined, "1"])(
    "counts actual chunked bytes with length header %s before JSON parsing",
    async (length) => {
      const app = await fixture();
      const cancel = vi.fn();
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (length) headers["content-length"] = length;
      const response = await app.request(
        new Request("http://localhost/api/user/avatar", {
          method: "PUT",
          headers,
          body: new ReadableStream({
            pull(controller) {
              controller.enqueue(new Uint8Array(16 * 1024));
            },
            cancel,
          }),
          duplex: "half",
        } as RequestInit),
      );
      // Invalid JSON would be 400 if the parser ran before the byte guard.
      expect(response.status).toBe(413);
      expect(cancel).toHaveBeenCalledOnce();
      expect(await db.select().from(schema.userAvatarTable)).toHaveLength(0);
    },
  );
  it("rejects oversized encoded input inside a bounded JSON request", async () => {
    const app = await fixture();
    const response = await app.request("/api/user/avatar", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: "image/png",
        data: " ".repeat(MAX_AVATAR_INPUT_CHARS + 1),
      }),
    });
    expect(response.status).toBe(400);
    expect(await db.select().from(schema.userAvatarTable)).toHaveLength(0);
  });
  it("stores a valid maximum-size avatar for an authenticated viewer", async () => {
    const app = await fixture();
    const bytes = Buffer.alloc(MAX_AVATAR_BYTES);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    const response = await app.request("/api/user/avatar", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: "image/png",
        data: bytes.toString("base64"),
      }),
    });
    expect(response.status, await response.text()).toBe(200);
    const [row] = await db.select().from(schema.userAvatarTable);
    expect(row.size).toBe(MAX_AVATAR_BYTES);
    expect(Buffer.from(row.data).equals(bytes)).toBe(true);
  });
});
