import { Cause, Effect } from "effect";
import { CliError } from "effect/cli";
import { describe, expect, it } from "vite-plus/test";
import { NotSignedIn } from "../errors/errors.js";
import { makeUi } from "../render/ui.js";
import { captureOutput } from "../testing/test-layers.js";
import { Output } from "./output.js";
import {
  classifyFailure,
  renderFailure,
  reportOutcome,
} from "./report-failure.js";

describe("classifyFailure", () => {
  it("shows requested help as normal output", () => {
    const cause = Cause.fail(
      new CliError.ShowHelp({ commandPath: ["kaneo"], errors: [] }),
    );
    expect(classifyFailure(cause, "USAGE")).toEqual({
      kind: "help",
      text: "USAGE",
    });
  });

  it("turns parse errors into a failure with a help hint", () => {
    const cause = Cause.fail(
      new CliError.ShowHelp({
        commandPath: ["kaneo", "task", "list"],
        errors: [
          new CliError.UnrecognizedOption({
            option: "--bogus",
            command: ["kaneo", "task", "list"],
            suggestions: [],
          }),
        ],
      }),
    );
    const outcome = classifyFailure(cause, "USAGE");
    expect(outcome.kind).toBe("failure");
    expect(outcome.kind === "failure" && outcome.failure.hint).toBe(
      "Run kaneo task list --help to see the options.",
    );
  });

  it("describes app errors and unexpected defects", () => {
    const signedOut = classifyFailure(
      Cause.fail(new NotSignedIn({ apiUrl: "https://x.test" })),
      "",
    );
    expect(signedOut.kind === "failure" && signedOut.failure.message).toBe(
      "You are not signed in to x.test.",
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
  it("prints exactly the JSON error contract on stdout", async () => {
    const output = captureOutput("json");
    await Effect.runPromise(
      Effect.gen(function* () {
        const shape = yield* Output;
        yield* reportOutcome(shape, {
          kind: "failure",
          failure: { message: "Nope", hint: "Try x" },
        });
      }).pipe(Effect.provide(output.layer)),
    );
    expect(output.stdout.join("")).toBe('{"error":"Nope"}\n');
    expect(output.stderr).toEqual([]);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe("renderFailure", () => {
  it("styles the message and hint", () => {
    const ui = makeUi({
      color: 0,
      unicode: true,
      hyperlinks: false,
      animate: false,
      columns: 80,
    });
    expect(
      renderFailure(ui, { message: "Nope", hint: "Run kaneo login" }),
    ).toEqual(["✗ Nope", "  → Run kaneo login"]);
  });
});
