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

// Regression tests for the Qodo review on PR #2242: the (project_id, type)
// uniqueness for non-repository integrations is a partial unique index
// (integration_project_type_null_repo_unique, WHERE repository_key IS NULL),
// so the chat integration upserts must repeat the predicate via
// ON CONFLICT for PostgreSQL to infer the arbiter. Without it, every second
// connect for the same project failed with 500 because no unique or
// exclusion constraint matched the ON CONFLICT target.

type App = ReturnType<typeof createApp>["app"];

beforeEach(resetTestDatabase);

async function chatFixture() {
  // The chat integration routes require workspace:manage_settings; the
  // built-in "member" role does not carry it, so seed an admin.
  const member = await createWorkspaceMember({ role: "admin" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  return { app, member, project };
}

function postJson(app: App, path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function integrationRows(projectId: string, type: string) {
  return db
    .select({
      id: schema.integrationTable.id,
      config: schema.integrationTable.config,
      isActive: schema.integrationTable.isActive,
      repositoryKey: schema.integrationTable.repositoryKey,
    })
    .from(schema.integrationTable)
    .where(
      and(
        eq(schema.integrationTable.projectId, projectId),
        eq(schema.integrationTable.type, type),
      ),
    );
}

describe("chat integration upserts", () => {
  it("upserts the Discord integration when the same project connects twice", async () => {
    const { app, project } = await chatFixture();
    const path = `/api/discord-integration/project/${project.id}`;

    const first = await postJson(app, path, {
      webhookUrl: "https://discord.com/api/webhooks/111111/first-secret",
    });
    expect(first.status).toBe(200);

    const second = await postJson(app, path, {
      webhookUrl: "https://discord.com/api/webhooks/111111/second-secret",
      channelName: "updates",
    });
    expect(second.status).toBe(200);

    const rows = await integrationRows(project.id, "discord");
    expect(rows).toHaveLength(1);
    expect(rows[0].repositoryKey).toBeNull();
    expect(rows[0].isActive).toBe(true);
    const config = JSON.parse(rows[0].config);
    expect(config.webhookUrl).toBe(
      "https://discord.com/api/webhooks/111111/second-secret",
    );
    expect(config.channelName).toBe("updates");

    const secondBody = await second.json();
    expect(secondBody.id).toBe(rows[0].id);
  });

  it("upserts the Telegram integration when the same project connects twice", async () => {
    const { app, project } = await chatFixture();
    const path = `/api/telegram-integration/project/${project.id}`;

    const first = await postJson(app, path, {
      botToken: "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      chatId: "-100",
    });
    expect(first.status).toBe(200);

    const second = await postJson(app, path, {
      botToken: "987654321:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      chatId: "-200",
      chatLabel: "ops",
    });
    expect(second.status).toBe(200);

    const rows = await integrationRows(project.id, "telegram");
    expect(rows).toHaveLength(1);
    expect(rows[0].repositoryKey).toBeNull();
    const config = JSON.parse(rows[0].config);
    expect(config.botToken).toBe(
      "987654321:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    );
    expect(config.chatId).toBe("-200");
    expect(config.chatLabel).toBe("ops");

    const secondBody = await second.json();
    expect(secondBody.id).toBe(rows[0].id);
  });
});
