import { describe, expect, it } from "vite-plus/test";
import { inOrder } from "./in-order.js";

describe("inOrder", () => {
  it("runs each task after the previous one settles, even when it fails", async () => {
    const run = inOrder();
    const steps: string[] = [];
    const slow = run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      steps.push("slow");
      throw new Error("slow failed");
    });
    const fast = run(async () => {
      steps.push("fast");
      return "done";
    });

    await expect(slow).rejects.toThrow("slow failed");
    await expect(fast).resolves.toBe("done");
    expect(steps).toEqual(["slow", "fast"]);
  });
});
