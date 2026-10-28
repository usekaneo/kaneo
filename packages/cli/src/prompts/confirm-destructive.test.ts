import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { captureOutput } from "../testing/test-layers.js";
import { confirmDestructive } from "./confirm-destructive.js";

const run = (yes: boolean) =>
  Effect.runPromise(
    confirmDestructive({
      yes,
      action: "Deleting KAN-12",
      question: "Delete KAN-12?",
    }).pipe(
      Effect.result,
      Effect.provide(
        Layer.merge(captureOutput("json").layer, NodeServices.layer),
      ),
    ),
  );

describe("confirmDestructive", () => {
  it("tells scripts to pass --yes in the error message itself", async () => {
    const result = await run(false);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toMatchObject({
        _tag: "InvalidArgument",
        message: "Deleting KAN-12 needs confirmation. Pass --yes to confirm.",
      });
      expect(result.failure).not.toHaveProperty("hint");
    }
  });

  it("goes ahead without asking when --yes is passed", async () => {
    expect(Result.isSuccess(await run(true))).toBe(true);
  });
});
