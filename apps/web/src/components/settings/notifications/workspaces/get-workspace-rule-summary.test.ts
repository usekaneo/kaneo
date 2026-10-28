import type { TFunction } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import type { ChannelAvailabilityMap } from "../notification-channels";
import { getWorkspaceRuleSummary } from "./get-workspace-rule-summary";
import type { WorkspaceRule } from "./workspace-rule-state";

const english: Record<string, string> = {
  "settings:notificationsPage.onlyInKaneo": "Only in Kaneo",
  "settings:notificationsPage.allProjects": "All projects",
  "settings:notificationsPage.emailTitle": "Email",
  "settings:notificationsPage.gotifyTitle": "Gotify",
  "settings:notificationsPage.ntfyTitle": "ntfy",
  "settings:notificationsPage.webhookTitle": "Custom webhook",
};

const t = ((key: string, options?: Record<string, unknown>) => {
  if (key === "settings:notificationsPage.projectCount") {
    return options?.count === 1
      ? "1 project"
      : `${String(options?.count)} projects`;
  }
  if (key === "settings:notificationsPage.ruleSummary") {
    return `${String(options?.channels)} · ${String(options?.projects)}`;
  }
  return english[key] ?? key;
}) as unknown as TFunction;

const availability: ChannelAvailabilityMap = {
  email: "available",
  gotify: "available",
  ntfy: "paused",
  webhook: "notConnected",
};

const rule: WorkspaceRule = {
  isActive: true,
  emailEnabled: true,
  gotifyEnabled: true,
  ntfyEnabled: false,
  webhookEnabled: false,
  projectMode: "all",
  selectedProjectIds: [],
};

describe("getWorkspaceRuleSummary", () => {
  it("says only in Kaneo when there is no rule", () => {
    expect(getWorkspaceRuleSummary(undefined, availability, t)).toBe(
      "Only in Kaneo",
    );
  });

  it("lists channels in a fixed order with the project scope", () => {
    expect(getWorkspaceRuleSummary(rule, availability, t)).toBe(
      "Email, Gotify · All projects",
    );
  });

  it("counts selected projects", () => {
    expect(
      getWorkspaceRuleSummary(
        {
          ...rule,
          gotifyEnabled: false,
          projectMode: "selected",
          selectedProjectIds: ["p1", "p2"],
        },
        availability,
        t,
      ),
    ).toBe("Email · 2 projects");
    expect(
      getWorkspaceRuleSummary(
        { ...rule, projectMode: "selected", selectedProjectIds: ["p1"] },
        availability,
        t,
      ),
    ).toBe("Email, Gotify · 1 project");
  });

  it("leaves out channels that cannot deliver right now", () => {
    expect(
      getWorkspaceRuleSummary(
        {
          ...rule,
          gotifyEnabled: false,
          ntfyEnabled: true,
          webhookEnabled: true,
        },
        availability,
        t,
      ),
    ).toBe("Email · All projects");
  });

  it("says only in Kaneo when no usable channel is left", () => {
    expect(
      getWorkspaceRuleSummary(
        {
          ...rule,
          emailEnabled: false,
          gotifyEnabled: false,
          ntfyEnabled: true,
        },
        availability,
        t,
      ),
    ).toBe("Only in Kaneo");
  });
});
