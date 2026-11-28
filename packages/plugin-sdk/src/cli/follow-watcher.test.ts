import { EventEmitter } from "node:events";
import { describe, expect, it } from "vite-plus/test";
import {
  followWatcher,
  isWatcher,
  type WatchUpdate,
} from "./follow-watcher.js";

function fakeWatcher() {
  const emitter = new EventEmitter();
  const updates: WatchUpdate[] = [];
  followWatcher(emitter, "node", (update) => updates.push(update));
  const send = (
    ...codes: Array<string | { code: string; error?: unknown }>
  ) => {
    for (const code of codes)
      emitter.emit("event", typeof code === "string" ? { code } : code);
  };
  return { send, updates };
}

describe("followWatcher", () => {
  it("reports a finished rebuild", () => {
    const { send, updates } = fakeWatcher();
    send("START", "BUNDLE_START", "BUNDLE_END", "END");
    expect(updates).toEqual([{ target: "node", error: null }]);
  });

  it("reports a failed rebuild once, without a success after it", () => {
    const { send, updates } = fakeWatcher();
    send(
      "START",
      { code: "ERROR", error: new Error("Unexpected token") },
      "END",
    );
    send("START", "BUNDLE_END", "END");
    expect(updates).toEqual([
      { target: "node", error: "Unexpected token" },
      { target: "node", error: null },
    ]);
  });

  it("closes each bundle result", () => {
    const emitter = new EventEmitter();
    let closed = 0;
    followWatcher(emitter, "web", () => {});
    emitter.emit("event", {
      code: "BUNDLE_END",
      result: { close: () => void closed++ },
    });
    expect(closed).toBe(1);
  });
});

describe("isWatcher", () => {
  it("recognizes event emitters only", () => {
    expect(isWatcher(new EventEmitter())).toBe(true);
    expect(isWatcher({ output: [] })).toBe(false);
    expect(isWatcher(null)).toBe(false);
  });
});
