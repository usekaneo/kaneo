import { describe, expect, it } from "vite-plus/test";
import type { AgentCodeRepository } from "@/types/agent";
import { getAgentCodeAvailability } from "./get-agent-code-availability";

const repository = (
  overrides: Partial<AgentCodeRepository>,
): AgentCodeRepository => ({
  integrationId: "integration",
  projectId: "project",
  host: "github",
  fullName: "usekaneo/kaneo",
  defaultBranch: "main",
  backend: "repo-ci",
  state: "ready",
  ...overrides,
});

const enabled = { enabled: true, canRunCode: true };

describe("getAgentCodeAvailability", () => {
  it("hides the action until coding is configured and permitted", () => {
    const repositories = [repository({})];
    expect(
      getAgentCodeAvailability(undefined, repositories, "project").state,
    ).toBe("hidden");
    expect(
      getAgentCodeAvailability(
        { enabled: false, canRunCode: false },
        repositories,
        "project",
      ).state,
    ).toBe("hidden");
    expect(
      getAgentCodeAvailability(
        { enabled: true, canRunCode: false },
        repositories,
        "project",
      ).state,
    ).toBe("hidden");
    expect(getAgentCodeAvailability(enabled, undefined, "project").state).toBe(
      "hidden",
    );
  });

  it("hides the action for projects without an opted-in repository", () => {
    expect(
      getAgentCodeAvailability(
        enabled,
        [repository({ projectId: "other" })],
        "project",
      ).state,
    ).toBe("hidden");
  });

  it("disables the action while no repository is ready", () => {
    expect(
      getAgentCodeAvailability(
        enabled,
        [repository({ state: "unavailable" })],
        "project",
      ).state,
    ).toBe("unavailable");
  });

  it("offers only the project's ready repositories", () => {
    const ready = repository({ integrationId: "ready" });
    expect(
      getAgentCodeAvailability(
        enabled,
        [
          ready,
          repository({ integrationId: "down", state: "unavailable" }),
          repository({ integrationId: "elsewhere", projectId: "other" }),
        ],
        "project",
      ),
    ).toEqual({ state: "ready", repositories: [ready] });
  });
});
