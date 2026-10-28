import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { pendingRunProject } from "../import-run-project";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  where: vi.fn(async () => undefined),
}));

vi.mock("../../database", () => ({
  default: {
    update: () => ({
      set: (values: unknown) => {
        mocks.set(values);
        return { where: mocks.where };
      },
    }),
  },
}));

type Registry = typeof import("../active-imports");
type Stopper = typeof import("./stop-active-imports");

let registry: Registry;
let stopper: Stopper;

function reserve() {
  const slot = registry.reserveImportSlot();
  if (!slot) throw new Error("expected a free slot");
  return slot;
}

function untilAborted(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve());
  });
}

describe("stopActiveImports", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    registry = await import("../active-imports");
    stopper = await import("./stop-active-imports");
  });

  it("refuses new imports even when nothing is running", async () => {
    await stopper.stopActiveImports(10);

    expect(() => registry.reserveImportSlot()).toThrow(HTTPException);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("waits for a start request that is still connecting, then stops its job", async () => {
    const slot = reserve();
    const stopping = stopper.stopActiveImports(1_000);
    expect(() => registry.reserveImportSlot()).toThrow(HTTPException);

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(slot.controller.signal.aborted).toBe(false);

    registry.trackImportJob(
      slot,
      "run-1",
      untilAborted(slot.controller.signal),
      () => [],
    );
    await stopping;

    expect(slot.controller.signal.aborted).toBe(true);
    expect(registry.activeImportSlots()).toEqual([]);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("marks a run stopped when its job does not finish in time", async () => {
    const slot = reserve();
    registry.trackImportJob(slot, "run-1", new Promise(() => {}), () => [
      { ...pendingRunProject("a", "Alpha"), status: "running" },
    ]);

    await stopper.stopActiveImports(10);

    expect(slot.controller.signal.aborted).toBe(true);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error: stopper.RESTART_ERROR,
        projects: [
          expect.objectContaining({
            status: "failed",
            error: stopper.RESTART_ERROR,
          }),
        ],
      }),
    );
  });

  it("stops waiting for a reservation after the grace period", async () => {
    const slot = reserve();

    await stopper.stopActiveImports(10);

    expect(slot.controller.signal.aborted).toBe(true);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
