import { describe, expect, it } from "vite-plus/test";
import { nextDeletionStep } from "./deletion-step.js";

describe("nextDeletionStep", () => {
  it("finishes on 200 and repeats on 202", () => {
    expect(nextDeletionStep({ kind: "deleted" }, 0)).toEqual({ kind: "done" });
    expect(nextDeletionStep({ kind: "pending" }, 59)).toEqual({
      kind: "repeat",
    });
  });

  it("waits for Retry-After, at least one second", () => {
    expect(
      nextDeletionStep({ kind: "busy", retryAfterSeconds: 15 }, 0),
    ).toEqual({ kind: "wait", seconds: 15 });
    expect(
      nextDeletionStep({ kind: "busy", retryAfterSeconds: null }, 0),
    ).toEqual({ kind: "wait", seconds: 1 });
    expect(nextDeletionStep({ kind: "busy", retryAfterSeconds: 0 }, 0)).toEqual(
      { kind: "wait", seconds: 1 },
    );
  });

  it("caps the total wait and then gives up", () => {
    expect(
      nextDeletionStep({ kind: "busy", retryAfterSeconds: 120 }, 20),
    ).toEqual({ kind: "wait", seconds: 40 });
    expect(
      nextDeletionStep({ kind: "busy", retryAfterSeconds: 1 }, 60),
    ).toEqual({ kind: "give-up" });
  });
});
