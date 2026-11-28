import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const initialServerUrl = "https://initial.example.invalid";
const nextServerUrl = "https://next.example.invalid";
const initialToken = `12345678:${"a".repeat(35)}`;
const replacementToken = `12345678:${"b".repeat(35)}`;

async function setupIntegration() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  mockAuthenticatedSession(user);

  const { app } = createApp();
  const path = `/api/telegram-integration/project/${project.id}`;
  const request = (method: "POST" | "PATCH", body: object) =>
    app.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const created = await request("POST", {
    botToken: initialToken,
    chatId: "test-chat",
    serverUrl: initialServerUrl,
  });
  expect(created.status).toBe(200);

  const readRow = () =>
    db.query.integrationTable.findFirst({
      where: and(
        eq(schema.integrationTable.projectId, project.id),
        eq(schema.integrationTable.type, "telegram"),
      ),
    });

  return { request, readRow };
}

describe("API integration: Telegram token rotation", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rotates the token when the expected server matches", async () => {
    const { request, readRow } = await setupIntegration();

    const result = await request("PATCH", {
      botToken: replacementToken,
      expectedServerUrl: initialServerUrl,
    });

    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ serverUrl: initialServerUrl });
    const stored = await readRow();
    const config = JSON.parse(stored?.config ?? "{}");
    expect(config.botToken === replacementToken).toBe(true);
    expect(config.serverUrl).toBe(initialServerUrl);
  });

  it("rejects a stale expected server and preserves the entire integration row", async () => {
    const { request, readRow } = await setupIntegration();
    const updated = await request("PATCH", {
      botToken: replacementToken,
      serverUrl: nextServerUrl,
    });
    expect(updated.status).toBe(200);
    const before = await readRow();
    expect(before).toBeDefined();

    const result = await request("PATCH", {
      expectedServerUrl: initialServerUrl,
      botToken: initialToken,
      chatLabel: "stale label",
      isActive: false,
    });

    expect(result.status).toBe(409);
    const after = await readRow();
    expect(after?.config === before?.config).toBe(true);
    expect(after?.isActive).toBe(before?.isActive);
    expect(after?.updatedAt).toEqual(before?.updatedAt);
  });
});
