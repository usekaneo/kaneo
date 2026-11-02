import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { initializeAutomationEvents } from "../../apps/api/src/agent/automation/subscribe";
import { publishEvent, shutdownEventBus } from "../../apps/api/src/events";
import { automationFixture } from "./helpers/agent-automation";
import { resetTestDatabase } from "./helpers/database";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
  vi.stubEnv("KANEO_CLOUD", "false");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await shutdownEventBus();
});

it("keeps distinct moves into the same column when subscribers observe the same task revision", async () => {
  const ctx = await automationFixture({
    trigger: { type: "event", event: "task_moved" },
  });
  await initializeAutomationEvents();
  const data = {
    taskId: ctx.task!.id,
    projectId: ctx.project.id,
    oldStatus: "to-do",
    newStatus: "in-review",
  };
  // Both publications describe distinct earlier moves. The persisted task has
  // already reached its latest revision before either subscriber reads it.
  await publishEvent("task.status_changed", data, { waitForHandlers: true });
  await publishEvent("task.status_changed", data, { waitForHandlers: true });
  const events = await db.select().from(schema.agentAutomationEventTable);
  expect(events).toHaveLength(2);
  expect(new Set(events.map((event) => event.dedupeKey)).size).toBe(2);
});

it("preserves explicit move receipt IDs after unrelated task edits", async () => {
  const ctx = await automationFixture({
    trigger: { type: "event", event: "task_moved" },
  });
  await initializeAutomationEvents();
  const data = {
    eventId: "provider:move:42",
    taskId: ctx.task!.id,
    projectId: ctx.project.id,
    oldStatus: "to-do",
    newStatus: "in-review",
  };
  await publishEvent("task.status_changed", data, { waitForHandlers: true });
  await db
    .update(schema.taskTable)
    .set({ title: "An unrelated later edit" })
    .where(eq(schema.taskTable.id, ctx.task!.id));
  await publishEvent("task.status_changed", data, { waitForHandlers: true });
  expect(await db.select().from(schema.agentAutomationEventTable)).toHaveLength(
    1,
  );
});
