import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type Registry = typeof import("./active-imports");

let registry: Registry;

function reserve() {
  const slot = registry.reserveImportSlot();
  if (!slot) throw new Error("expected a free slot");
  return slot;
}

async function hasSettled(promise: Promise<unknown>) {
  let settled = false;
  void promise.then(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return settled;
}

describe("active imports", () => {
  beforeEach(async () => {
    vi.resetModules();
    registry = await import("./active-imports");
  });

  it("reserves up to the server limit", () => {
    const first = reserve();
    for (let count = 1; count < registry.MAX_ACTIVE_IMPORTS; count++) {
      reserve();
    }

    expect(registry.reserveImportSlot()).toBeNull();

    registry.releaseImportSlot(first);
    expect(registry.reserveImportSlot()).not.toBeNull();
  });

  it("settles a reservation once its job is attached", async () => {
    const slot = reserve();

    expect(await hasSettled(slot.settled)).toBe(false);

    registry.trackImportJob(slot, "run-1", new Promise(() => {}), () => []);

    expect(await hasSettled(slot.settled)).toBe(true);
    expect(registry.activeImportSlots()).toEqual([slot]);
  });

  it("settles a reservation that is released without a job", async () => {
    const slot = reserve();

    registry.releaseImportSlot(slot);

    expect(await hasSettled(slot.settled)).toBe(true);
    expect(registry.activeImportSlots()).toEqual([]);
  });

  it("frees the slot when the job finishes", async () => {
    const slot = reserve();

    registry.trackImportJob(slot, "run-1", Promise.resolve(), () => []);
    await registry.waitForActiveImports();

    expect(registry.activeImportSlots()).toEqual([]);
  });

  it("refuses new reservations once the server is shutting down", () => {
    registry.stopAcceptingImports();

    let refused: unknown;
    try {
      registry.reserveImportSlot();
    } catch (error) {
      refused = error;
    }

    expect(refused).toBeInstanceOf(HTTPException);
    expect(refused).toMatchObject({
      status: 503,
      message: "Kaneo is restarting. Start the import again in a minute.",
    });
    expect(registry.activeImportSlots()).toEqual([]);
  });
});
