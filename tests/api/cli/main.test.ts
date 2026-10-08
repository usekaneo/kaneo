import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { main } from "../../../apps/api/src/cli/main";

function collect() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    output: {
      log: (message: string) => out.push(message),
      error: (message: string) => err.push(message),
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("main", () => {
  it("prints help for each command", async () => {
    for (const argv of [
      [],
      ["check", "--help"],
      ["add", "-h"],
      ["plugin", "purge", "--help"],
    ]) {
      const { out, output } = collect();
      expect(await main(argv, output)).toBe(0);
      expect(out.join("\n")).toMatch(/^Usage: kaneo/);
    }
  });

  it("prints the Kaneo version", async () => {
    vi.stubEnv("KANEO_VERSION", "9.1.0");
    vi.resetModules();
    const fresh = await import("../../../apps/api/src/cli/main");
    const { out, output } = collect();
    expect(await fresh.main(["--version"], output)).toBe(0);
    expect(out).toEqual(["9.1.0"]);
  });

  it("exits with 1 and a message on usage errors", async () => {
    const { err, output } = collect();
    expect(await main(["frobnicate"], output)).toBe(1);
    expect(err[0]).toContain('Unknown command "frobnicate"');
  });

  it("fails when the project directory does not exist", async () => {
    const { err, output } = collect();
    expect(
      await main(
        ["add", "kaneo-plugin-x", "--project", "/no/such/dir"],
        output,
      ),
    ).toBe(1);
    expect(err).toEqual(["The project directory /no/such/dir does not exist."]);
  });
});
