import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { KaneoApiLayer } from "../../api/kaneo-api.js";
import {
  captureOutput,
  fakeHttpClient,
  json,
  memoryConfigStore,
  type RecordedRequest,
  type Responder,
  testSession,
} from "../../testing/test-layers.js";
import { runPluginPurge } from "./purge.js";

function run(pluginId: string, yes: boolean, respond: Responder) {
  const recorded: RecordedRequest[] = [];
  const output = captureOutput("json");
  const api = KaneoApiLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        fakeHttpClient(respond, recorded),
        testSession(),
        memoryConfigStore().layer,
      ),
    ),
  );
  const result = Effect.runPromise(
    Effect.result(
      runPluginPurge({ pluginId, yes }).pipe(
        Effect.provide(Layer.mergeAll(api, output.layer, NodeServices.layer)),
      ),
    ),
  );
  return { recorded, output, result };
}

describe("kaneo plugin purge", () => {
  it("deletes the data through the API and prints the counts", async () => {
    const { recorded, output, result } = run("kaneo-plugin-old", true, () =>
      json({ storage: 3, workspaces: 2 }),
    );
    expect(Result.isSuccess(await result)).toBe(true);
    expect(recorded[0]).toMatchObject({
      method: "DELETE",
      url: "https://kaneo.test/api/plugins/kaneo-plugin-old/data",
    });
    expect(JSON.parse(output.stdout.join(""))).toEqual({
      pluginId: "kaneo-plugin-old",
      storage: 3,
      workspaces: 2,
    });
  });

  it("needs --yes outside a terminal and sends nothing", async () => {
    const { recorded, result } = run("kaneo-plugin-old", false, () =>
      json({ storage: 0, workspaces: 0 }),
    );
    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure).toMatchObject({
      _tag: "InvalidArgument",
      message:
        "Purging the data of kaneo-plugin-old needs confirmation. Pass --yes to confirm.",
    });
    expect(recorded).toEqual([]);
  });

  it("passes on the server's refusal for an installed plugin", async () => {
    const message =
      'Plugin "kaneo-plugin-old" is still installed. Remove it from kaneo.config.ts and restart Kaneo, then purge its data.';
    const { result } = run("kaneo-plugin-old", true, () =>
      json({ message, code: "CONFLICT" }, 409),
    );
    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure).toMatchObject({
      _tag: "Conflict",
      message,
    });
  });

  it("asks for an instance admin when the server refuses the user", async () => {
    const { result } = run("kaneo-plugin-old", true, () =>
      json({ message: "Instance administrator access is required" }, 403),
    );
    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure).toMatchObject({
      _tag: "InvalidArgument",
      message: "Instance administrator access is required",
      hint: "Purging plugin data needs an instance admin. Run kaneo login with an instance admin account.",
    });
  });

  it("rejects values that cannot be plugin IDs before calling the API", async () => {
    const { recorded, result } = run("Not An Id", true, () => json({}));
    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure.message).toBe(
      '"Not An Id" is not a plugin ID.',
    );
    expect(recorded).toEqual([]);
  });
});
