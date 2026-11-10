import { describe, it, expect, vi } from "vite-plus/test";
import { createEmitter } from "../src/core/events";

describe("events", () => {
  it("calls a subscribed handler with the payload", () => {
    const e = createEmitter();
    const fn = vi.fn();
    e.on("vote", fn);
    e.emit("vote", { postId: "p1", voted: true, voteCount: 5 });
    expect(fn).toHaveBeenCalledWith({
      postId: "p1",
      voted: true,
      voteCount: 5,
    });
  });

  it("returns an unsubscribe function from on()", () => {
    const e = createEmitter();
    const fn = vi.fn();
    const unsub = e.on("vote", fn);
    unsub();
    e.emit("vote", { postId: "p1", voted: true, voteCount: 0 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("off() removes a specific handler", () => {
    const e = createEmitter();
    const a = vi.fn();
    const b = vi.fn();
    e.on("vote", a);
    e.on("vote", b);
    e.off("vote", a);
    e.emit("vote", { postId: "p1", voted: true, voteCount: 0 });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });

  it("off() with no handler removes all for that event", () => {
    const e = createEmitter();
    const a = vi.fn();
    const b = vi.fn();
    e.on("vote", a);
    e.on("vote", b);
    e.off("vote");
    e.emit("vote", { postId: "p1", voted: true, voteCount: 0 });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("swallows handler errors so one bad listener does not break others", () => {
    const e = createEmitter();
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    e.on("vote", bad);
    e.on("vote", good);
    e.emit("vote", { postId: "p1", voted: true, voteCount: 0 });
    expect(good).toHaveBeenCalled();
  });
});
