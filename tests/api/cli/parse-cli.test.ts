import { describe, expect, it } from "vite-plus/test";
import { CliError } from "../../../apps/api/src/cli/cli-error";
import { parseCli } from "../../../apps/api/src/cli/parse-cli";

function usageError(argv: string[]): string {
  try {
    parseCli(argv);
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    return (error as CliError).message;
  }
  throw new Error(`Expected ${argv.join(" ")} to fail`);
}

describe("parseCli", () => {
  it("shows the main help without a command or with --help", () => {
    expect(parseCli([])).toEqual({ name: "help", topic: "kaneo" });
    expect(parseCli(["--help"])).toEqual({ name: "help", topic: "kaneo" });
    expect(parseCli(["-h"])).toEqual({ name: "help", topic: "kaneo" });
    expect(parseCli(["help"])).toEqual({ name: "help", topic: "kaneo" });
  });

  it("prints the version", () => {
    expect(parseCli(["--version"])).toEqual({ name: "version" });
    expect(parseCli(["-v"])).toEqual({ name: "version" });
  });

  it("parses check with its options", () => {
    expect(parseCli(["check"])).toEqual({
      name: "check",
      project: undefined,
      config: undefined,
    });
    expect(
      parseCli(["check", "--config", "conf/kaneo.config.ts", "--project=/srv"]),
    ).toEqual({
      name: "check",
      project: "/srv",
      config: "conf/kaneo.config.ts",
    });
    expect(parseCli(["check", "--help"])).toEqual({
      name: "help",
      topic: "check",
    });
  });

  it("parses add with exactly one package", () => {
    expect(parseCli(["add", "kaneo-plugin-task-progress"])).toEqual({
      name: "add",
      packageName: "kaneo-plugin-task-progress",
      yes: false,
      project: undefined,
    });
    expect(parseCli(["add", "-y", "@acme/reports", "--project", "."])).toEqual({
      name: "add",
      packageName: "@acme/reports",
      yes: true,
      project: ".",
    });
    expect(parseCli(["add", "-h"])).toEqual({ name: "help", topic: "add" });
    expect(usageError(["add"])).toContain("takes exactly one package name");
    expect(usageError(["add", "a", "b"])).toContain(
      "takes exactly one package name",
    );
  });

  it("parses plugin purge", () => {
    expect(parseCli(["plugin", "purge", "kaneo-plugin-old", "--yes"])).toEqual({
      name: "purge",
      pluginId: "kaneo-plugin-old",
      yes: true,
      project: undefined,
      config: undefined,
    });
    expect(parseCli(["plugin"])).toEqual({ name: "help", topic: "plugin" });
    expect(parseCli(["plugin", "--help"])).toEqual({
      name: "help",
      topic: "plugin",
    });
    expect(parseCli(["plugin", "purge", "--help"])).toEqual({
      name: "help",
      topic: "plugin purge",
    });
    expect(usageError(["plugin", "purge"])).toContain(
      "takes exactly one plugin id",
    );
  });

  it("rejects unknown commands and options with a pointer to help", () => {
    expect(usageError(["install"])).toBe(
      'Unknown command "install".\nRun "kaneo --help" for the list of commands.',
    );
    expect(usageError(["plugin", "remove", "x"])).toContain(
      'Unknown command "kaneo plugin remove"',
    );
    const message = usageError(["check", "--force"]);
    expect(message).toContain("--force");
    expect(message).toContain('Run "kaneo check --help" for usage.');
    expect(usageError(["check", "extra"])).toContain(
      'Run "kaneo check --help"',
    );
    expect(usageError(["add", "--project"])).toContain(
      'Run "kaneo add --help"',
    );
  });
});
