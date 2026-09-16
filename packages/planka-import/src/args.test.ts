import { describe, expect, it } from "vitest";
import { DEFAULT_KANEO_URL, parseArgs } from "./args.js";

describe("parseArgs", () => {
  it("returns defaults for an empty argv", () => {
    const parsed = parseArgs([]);

    expect(parsed.projects).toEqual([]);
    expect(parsed.dryRun).toBe(false);
    expect(parsed.all).toBe(false);
  });

  it("parses space-separated values", () => {
    const parsed = parseArgs([
      "--planka-url",
      "https://planka.acme.com",
      "--workspace",
      "ws_1",
    ]);

    expect(parsed.plankaUrl).toBe("https://planka.acme.com");
    expect(parsed.workspace).toBe("ws_1");
  });

  it("parses inline --flag=value form", () => {
    const parsed = parseArgs(["--kaneo-api-key=kaneo_abc"]);

    expect(parsed.kaneoApiKey).toBe("kaneo_abc");
  });

  it("collects repeated --project flags", () => {
    const parsed = parseArgs([
      "--project",
      "Marketing",
      "--project=Engineering",
    ]);

    expect(parsed.projects).toEqual(["Marketing", "Engineering"]);
  });

  it("parses boolean flags and their short forms", () => {
    const parsed = parseArgs(["--dry-run", "--skip-comments", "-y"]);

    expect(parsed.dryRun).toBe(true);
    expect(parsed.skipComments).toBe(true);
    expect(parsed.yes).toBe(true);
  });

  it("keeps a value that looks like a flag when given inline", () => {
    const parsed = parseArgs(["--planka-password=--weird--"]);

    expect(parsed.plankaPassword).toBe("--weird--");
  });

  it("rejects unknown options", () => {
    expect(() => parseArgs(["--nope"])).toThrow("Unknown option: --nope");
  });

  it("rejects a flag that is missing its value", () => {
    expect(() => parseArgs(["--workspace"])).toThrow(
      "--workspace requires a value",
    );
  });
});

describe("DEFAULT_KANEO_URL", () => {
  it("points at Kaneo Cloud and is echoed in the help text", async () => {
    const { HELP_TEXT } = await import("./args.js");

    expect(DEFAULT_KANEO_URL).toBe("https://cloud.kaneo.app");
    expect(HELP_TEXT).toContain(DEFAULT_KANEO_URL);
  });
});
