import type { TFunction } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import type { AutomationRun } from "@/types/agent-automation";
import { describeAutomationRun } from "./describe-automation-run";

const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

type Trigger = NonNullable<AutomationRun["trigger"]>;
const base: Trigger = {
  automationId: "a",
  source: "event",
  output: "proposals",
  scheduledFor: null,
  events: [],
  moreEvents: 0,
};
const event = {
  event: "pr_merged" as const,
  taskId: "t",
  projectId: "p",
  occurredAt: "2026-10-28T10:00:00.000Z",
  actorName: "Mira",
  columnName: null,
  pullRequest: { number: 42, title: "Retry", url: "https://example.com" },
  commentPreview: null,
};

describe("describeAutomationRun", () => {
  it("names schedule and manual runs", () => {
    expect(describeAutomationRun({ ...base, source: "schedule" }, t)).toBe(
      "agent:automations.runs.scheduled",
    );
    expect(describeAutomationRun({ ...base, source: "manual" }, t)).toBe(
      "agent:automations.runs.manual",
    );
    expect(describeAutomationRun(null, t)).toBe(
      "agent:automations.runs.manual",
    );
  });

  it("names the first event and counts the rest of the batch", () => {
    expect(describeAutomationRun({ ...base, events: [event] }, t)).toBe(
      "agent:automations.events.pr_merged · #42",
    );
    expect(
      describeAutomationRun(
        {
          ...base,
          events: [
            { ...event, event: "task_created", pullRequest: null },
            event,
          ],
          moreEvents: 3,
        },
        t,
      ),
    ).toBe(
      'agent:automations.runs.andMore {"label":"agent:automations.events.task_created","count":4}',
    );
  });
});
