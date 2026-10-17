import { describe, expect, it } from "vite-plus/test";
import {
  getInitials,
  getNextStep,
  getOnboardingSteps,
  getStepProgress,
} from "./onboarding-steps";

describe("onboarding steps", () => {
  it.each([
    [
      { usage: "team", canInvite: true, offersPlan: true },
      ["workspace", "usage", "project", "invite", "plan"],
    ],
    [
      { usage: "team", canInvite: true, offersPlan: false },
      ["workspace", "usage", "project", "invite", "ready"],
    ],
    [
      { usage: "team", canInvite: false, offersPlan: false },
      ["workspace", "usage", "project", "ready"],
    ],
    [
      { usage: "solo", canInvite: true, offersPlan: true },
      ["workspace", "usage", "project", "plan"],
    ],
  ] as const)("orders the steps for %j", (options, steps) => {
    expect(getOnboardingSteps(options)).toEqual(steps);
  });

  it("counts every step except the ready screen", () => {
    const steps = getOnboardingSteps({
      usage: "team",
      canInvite: true,
      offersPlan: false,
    });
    expect(getStepProgress(steps, "project")).toEqual({ current: 3, total: 4 });
    expect(getStepProgress(steps, "invite")).toEqual({ current: 4, total: 4 });
  });

  it("moves to the next step and ends on ready", () => {
    const steps = getOnboardingSteps({
      usage: "solo",
      canInvite: true,
      offersPlan: false,
    });
    expect(getNextStep(steps, "project")).toBe("ready");
    expect(getNextStep(steps, "ready")).toBe("ready");
  });

  it.each([
    ["sarah@acme.com", "S"],
    ["  mark.k@acme.com", "M"],
    ["élodie@acme.fr", "É"],
    ["", ""],
  ])("takes the initial of %j", (value, initial) => {
    expect(getInitials(value)).toBe(initial);
  });
});
