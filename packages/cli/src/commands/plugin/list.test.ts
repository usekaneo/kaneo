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
import { runPluginList } from "./list.js";

const PLUGINS = {
  plugins: [
    {
      id: "gantt",
      name: "Gantt",
      packageName: "@kaneo/gantt",
      version: "0.1.0",
      description: "Timeline view",
      official: true,
      settings: {},
      web: null,
      workspace: { enabled: true, settings: {}, configuredSecrets: [] },
    },
  ],
};

function run(respond: Responder, mode: "json" | "human" = "json") {
  const recorded: RecordedRequest[] = [];
  const output = captureOutput(mode);
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
      runPluginList().pipe(
        Effect.provide(
          Layer.mergeAll(api, testSession(), output.layer, NodeServices.layer),
        ),
      ),
    ),
  );
  return { recorded, output, result };
}

describe("kaneo plugin list", () => {
  it("lists the plugins with their state in the current workspace", async () => {
    const { recorded, output, result } = run(() => json(PLUGINS));
    expect(Result.isSuccess(await result)).toBe(true);
    expect(recorded[0]?.url).toBe(
      "https://kaneo.test/api/plugins?workspaceId=ws_1",
    );
    expect(JSON.parse(output.stdout.join(""))).toEqual([
      {
        id: "gantt",
        name: "Gantt",
        packageName: "@kaneo/gantt",
        version: "0.1.0",
        description: "Timeline view",
        official: true,
        enabled: true,
      },
    ]);
  });

  it("prints a table in a terminal", async () => {
    const { output, result } = run(() => json(PLUGINS), "human");
    await result;
    expect(output.stdout.join("")).toContain("Gantt  gantt  0.1.0");
  });
});
