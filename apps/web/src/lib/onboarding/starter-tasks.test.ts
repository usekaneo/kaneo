import type { TFunction } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import { starterTasks } from "./starter-tasks";

const t = ((key: string) => key) as unknown as TFunction;

describe("starterTasks", () => {
  it("includes the invite task for teams", () => {
    expect(starterTasks(t, "team").map((task) => task.title)).toEqual([
      "auth:onboarding.starterTasks.drag.title",
      "auth:onboarding.starterTasks.details.title",
      "auth:onboarding.starterTasks.invite.title",
      "auth:onboarding.starterTasks.integrations.title",
      "auth:onboarding.starterTasks.create.title",
    ]);
  });

  it("leaves the invite task out for a single person", () => {
    expect(
      starterTasks(t, "solo").some((task) =>
        task.title.includes("starterTasks.invite"),
      ),
    ).toBe(false);
  });

  it("puts every task in To Do without a priority", () => {
    for (const task of starterTasks(t, "team")) {
      expect(task.status).toBe("to-do");
      expect(task.priority).toBe("no-priority");
      expect(task.description).toMatch(/\.description$/);
    }
  });
});
