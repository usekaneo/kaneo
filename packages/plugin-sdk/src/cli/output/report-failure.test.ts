import { Cause, Effect } from "effect";
import { CliError } from "effect/cli";
import { describe, expect, it } from "vite-plus/test";
import { EntryMissing } from "../errors/errors.js";
import type { OutputMode } from "./output-mode.js";
import type { OutputShape } from "./output.js";
import {
  classifyFailure,
  renderFailure,
  reportOutcome,
} from "./report-failure.js";
import { makeTheme } from "./theme.js";

function captureOutput(mode: OutputMode) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const theme = makeTheme(false);
  const output: OutputShape = {
    mode,
    theme,
    errTheme: theme,
    out: (text) => Effect.sync(() => void stdout.push(text)),
    err: (text) => Effect.sync(() => void stderr.push(text)),
  };
  return { output, stdout, stderr };
}

describe("classifyFailure", () => {
  it("shows requested help as normal output", () => {
    const cause = Cause.fail(
      new CliError.ShowHelp({ commandPath: ["kaneo-plugin"], errors: [] }),
    );
    expect(classifyFailure(cause, "USAGE")).toEqual({
      kind: "help",
      text: "USAGE",
    });
  });

  it("turns parse errors into a failure with a help hint", () => {
    const cause = Cause.fail(
      new CliError.ShowHelp({
        commandPath: ["kaneo-plugin", "build"],
        errors: [
          new CliError.UnrecognizedOption({
            option: "--bogus",
            command: ["kaneo-plugin", "build"],
            suggestions: [],
          }),
        ],
      }),
    );
    const outcome = classifyFailure(cause, "USAGE");
    expect(outcome.kind === "failure" && outcome.failure.hint).toBe(
      "Run kaneo-plugin build --help to see the options.",
    );
  });

  it("describes build errors and unexpected defects", () => {
    const missing = classifyFailure(Cause.fail(new EntryMissing()), "");
    expect(missing.kind === "failure" && missing.failure.message).toBe(
      "src/index.ts is missing. It must default-export definePlugin(import.meta.url, { ... }).",
    );
    const defect = classifyFailure(Cause.die(new Error("boom")), "");
    expect(defect.kind === "failure" && defect.failure.message).toBe(
      "Unexpected error: boom",
    );
  });

  it("recognizes Ctrl+C", () => {
    expect(classifyFailure(Cause.interrupt(), "").kind).toBe("interrupted");
  });
});

describe("reportOutcome", () => {
  const failure = {
    kind: "failure",
    failure: { message: "Nope", hint: "Try x" },
  } as const;

  it("prints exactly the JSON error contract on stdout", async () => {
    const { output, stdout, stderr } = captureOutput("json");
    expect(await Effect.runPromise(reportOutcome(output, failure))).toBe(1);
    expect(stdout.join("")).toBe('{"error":"Nope"}\n');
    expect(stderr).toEqual([]);
  });

  it("prints styled errors on stderr in human mode", async () => {
    const { output, stdout, stderr } = captureOutput("human");
    expect(await Effect.runPromise(reportOutcome(output, failure))).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr.join("")).toBe("error: Nope\nTry x\n");
  });

  it("exits with 130 after Ctrl+C", async () => {
    const { output } = captureOutput("json");
    expect(
      await Effect.runPromise(reportOutcome(output, { kind: "interrupted" })),
    ).toBe(130);
  });
});

describe("renderFailure", () => {
  it("colors the message", () => {
    expect(
      renderFailure(makeTheme(true), { message: "Nope", hint: null }),
    ).toEqual(["\u001b[31merror: Nope\u001b[39m"]);
  });
});
