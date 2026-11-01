import { describe, expect, it } from "vite-plus/test";
import type { Automation } from "@/types/agent-automation";
import {
  automationToDraft,
  createAutomationDraft,
  draftToAutomationInput,
} from "./automation-draft";

const base = {
  ...createAutomationDraft("Europe/Berlin"),
  name: "  Triage bugs ",
  prompt: " Sort new bugs \n",
};

describe("draftToAutomationInput", () => {
  it("sends only the fields the chosen schedule uses", () => {
    expect(
      draftToAutomationInput({
        ...base,
        frequency: "weekly",
        weekdays: [1, 4],
      }),
    ).toEqual({
      name: "Triage bugs",
      prompt: "Sort new bugs",
      projectId: null,
      output: "proposals",
      dailyRunLimit: 24,
      trigger: {
        type: "schedule",
        frequency: "weekly",
        time: "09:00",
        weekdays: [1, 4],
        intervalHours: null,
        timezone: "Europe/Berlin",
      },
    });
    expect(
      draftToAutomationInput({ ...base, frequency: "interval" }).trigger,
    ).toMatchObject({ weekdays: [], intervalHours: 4 });
  });

  it("drops the project filter when the scope is one project", () => {
    const draft = {
      ...base,
      triggerType: "event" as const,
      event: "task_moved" as const,
      columnName: "Done",
      filterProjectId: "p2",
      model: "openai/gpt",
    };
    expect(draftToAutomationInput(draft)).toMatchObject({
      model: "openai/gpt",
      trigger: {
        type: "event",
        event: "task_moved",
        filters: { labelName: null, columnName: "Done", projectId: "p2" },
      },
    });
    expect(
      draftToAutomationInput({ ...draft, projectId: "p1" }).trigger,
    ).toMatchObject({ filters: { projectId: null } });
  });
});

describe("automationToDraft", () => {
  it("round-trips an event automation and keeps schedule defaults", () => {
    const automation = {
      name: "Bugs",
      prompt: "Triage",
      projectId: null,
      output: "digest",
      model: "m",
      dailyRunLimit: 5,
      trigger: {
        type: "event",
        event: "comment_added",
        filters: { labelName: "Bug", columnName: null, projectId: "p" },
      },
    } as Automation;
    const draft = automationToDraft(automation, "UTC");
    expect(draft).toMatchObject({
      triggerType: "event",
      event: "comment_added",
      labelName: "Bug",
      filterProjectId: "p",
      frequency: "weekly",
      timezone: "UTC",
      dailyRunLimit: 5,
    });
    expect(draftToAutomationInput(draft)).toMatchObject({
      name: "Bugs",
      output: "digest",
      trigger: automation.trigger,
    });
  });

  it("uses an empty prompt when it is redacted", () => {
    const automation = {
      name: "Hidden",
      prompt: null,
      projectId: null,
      output: "proposals",
      model: "m",
      dailyRunLimit: 24,
      trigger: {
        type: "schedule",
        frequency: "daily",
        time: "08:30",
        weekdays: [] as number[],
        intervalHours: null,
        timezone: "America/New_York",
      },
    } as Automation;
    expect(automationToDraft(automation, "UTC")).toMatchObject({
      prompt: "",
      frequency: "daily",
      time: "08:30",
      weekdays: [1],
      timezone: "America/New_York",
    });
  });
});
