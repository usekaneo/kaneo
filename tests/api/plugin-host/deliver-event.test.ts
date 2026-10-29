import type { PluginEvent } from "@kaneo/plugin-sdk";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  deliverEvent,
  pluginsHandling,
} from "../../../apps/api/src/plugin-host/events/deliver-event";
import type { LoadedPlugin } from "../../../apps/api/src/plugin-host/types";

type Handler = (event: PluginEvent) => void | Promise<void>;

function plugin(id: string, handlers: Record<string, Handler[]>): LoadedPlugin {
  return {
    id,
    name: id,
    packageName: id,
    version: "1.0.0",
    description: null,
    official: false,
    settings: {},
    options: undefined,
    web: null,
    server: {
      routes: {} as never,
      webhooks: {} as never,
      handlers: new Map(Object.entries(handlers)) as never,
    },
  };
}

const event: PluginEvent = {
  type: "task.deleted",
  workspaceId: "workspace-1",
  projectId: "project-1",
  taskId: "task-1",
  actorId: null,
  title: "Gone",
};

describe("deliverEvent", () => {
  it("runs handlers of enabled plugins sequentially in declaration order", async () => {
    const calls: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const plugins = [
      plugin("first", {
        "task.deleted": [
          async () => {
            calls.push("first-a-start");
            await gate;
            calls.push("first-a-end");
          },
          () => {
            calls.push("first-b");
          },
        ],
      }),
      plugin("disabled", { "task.deleted": [() => calls.push("disabled")] }),
      plugin("second", { "task.deleted": [() => calls.push("second")] }),
    ];

    const delivery = deliverEvent(plugins, new Set(["first", "second"]), event);
    expect(calls).toEqual(["first-a-start"]);
    release();
    await delivery;
    expect(calls).toEqual([
      "first-a-start",
      "first-a-end",
      "first-b",
      "second",
    ]);
  });

  it("logs a failing handler and keeps delivering", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const next = vi.fn();
    await deliverEvent(
      [
        plugin("broken", {
          "task.deleted": [
            () => {
              throw new Error("nope");
            },
          ],
        }),
        plugin("fine", { "task.deleted": [next] }),
      ],
      new Set(["broken", "fine"]),
      event,
    );
    expect(log).toHaveBeenCalledWith(
      "[plugin:broken] task.deleted handler failed",
      expect.any(Error),
    );
    expect(next).toHaveBeenCalledWith(event);
    log.mockRestore();
  });

  it("gives each handler its own copy of the event", async () => {
    await deliverEvent(
      [
        plugin("mutating", {
          "task.deleted": [
            (received) => {
              (received as { title: string }).title = "changed";
            },
          ],
        }),
        plugin("reader", {
          "task.deleted": [
            (received) => {
              expect(received).toMatchObject({ title: "Gone" });
            },
          ],
        }),
      ],
      new Set(["mutating", "reader"]),
      event,
    );
    expect(event).toMatchObject({ title: "Gone" });
  });
});

describe("pluginsHandling", () => {
  it("keeps only plugins with handlers for the event", () => {
    const handling = plugin("a", { "task.deleted": [() => {}] });
    const other = plugin("b", { "task.created": [() => {}] });
    const webOnly = { ...plugin("c", {}), server: null };
    expect(pluginsHandling([handling, other, webOnly], "task.deleted")).toEqual(
      [handling],
    );
  });
});
