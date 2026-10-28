import { describe, expect, it, vi } from "vite-plus/test";
import { createPacedFetch, MAX_PACE_MS, pauseUntil } from "./pacing.js";

const NOW = 1_700_000_000_000;

function respond(headers: Record<string, string>) {
  return new Response("{}", { status: 200, headers });
}

function setup(responses: Response[]) {
  let clock = NOW;
  const sleep = vi.fn(async (ms: number) => {
    clock += ms;
  });
  const inner = vi.fn(async () => responses.shift() ?? respond({}));
  const paced = createPacedFetch(inner, { now: () => clock, sleep });
  return { paced, inner, sleep, advance: (ms: number) => (clock += ms) };
}

describe("pauseUntil", () => {
  it("returns the reset time when one or no requests remain", () => {
    const reset = String(NOW / 1000 + 30);
    for (const remaining of ["0", "1"]) {
      const headers = new Headers({
        "X-RateLimit-Remaining": remaining,
        "X-RateLimit-Reset": reset,
      });
      expect(pauseUntil(headers, NOW)).toBe(NOW + 30_000);
    }
  });

  it("does not pause while requests remain or headers are missing", () => {
    const reset = String(NOW / 1000 + 30);
    expect(
      pauseUntil(
        new Headers({
          "X-RateLimit-Remaining": "2",
          "X-RateLimit-Reset": reset,
        }),
        NOW,
      ),
    ).toBe(0);
    expect(pauseUntil(new Headers({ "X-RateLimit-Remaining": "0" }), NOW)).toBe(
      0,
    );
    expect(pauseUntil(new Headers({ "X-RateLimit-Reset": reset }), NOW)).toBe(
      0,
    );
    expect(
      pauseUntil(
        new Headers({
          "X-RateLimit-Remaining": "",
          "X-RateLimit-Reset": reset,
        }),
        NOW,
      ),
    ).toBe(0);
  });

  it("ignores reset times in the past and accepts relative seconds", () => {
    expect(
      pauseUntil(
        new Headers({
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(NOW / 1000 - 5),
        }),
        NOW,
      ),
    ).toBe(0);
    expect(
      pauseUntil(
        new Headers({
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": "12",
        }),
        NOW,
      ),
    ).toBe(NOW + 12_000);
  });
});

describe("createPacedFetch", () => {
  it("waits until the reset before the next request when the budget runs out", async () => {
    const { paced, inner, sleep } = setup([
      respond({
        "X-RateLimit-Remaining": "1",
        "X-RateLimit-Reset": String(NOW / 1000 + 20),
      }),
      respond({
        "X-RateLimit-Remaining": "59",
        "X-RateLimit-Reset": String(NOW / 1000 + 80),
      }),
    ]);

    await paced("https://api.plane.so/a");
    expect(sleep).not.toHaveBeenCalled();

    await paced("https://api.plane.so/b");
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0]?.[0]).toBe(20_000);

    await paced("https://api.plane.so/c");
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(3);
  });

  it("skips the wait when the reset already passed", async () => {
    const { paced, sleep, advance } = setup([
      respond({
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(NOW / 1000 + 5),
      }),
    ]);

    await paced("https://api.plane.so/a");
    advance(6_000);
    await paced("https://api.plane.so/b");
    expect(sleep).not.toHaveBeenCalled();
  });

  it("caps the wait and passes the request signal to sleep", async () => {
    const { paced, sleep } = setup([
      respond({
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(NOW / 1000 + 600),
      }),
    ]);
    const controller = new AbortController();

    await paced("https://api.plane.so/a");
    await paced("https://api.plane.so/b", { signal: controller.signal });
    expect(sleep).toHaveBeenCalledWith(MAX_PACE_MS, controller.signal);
  });

  it("stops waiting when the request is aborted", async () => {
    const inner = vi.fn(async () =>
      respond({
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 30),
      }),
    );
    const paced = createPacedFetch(inner);
    await paced("https://api.plane.so/a");

    const controller = new AbortController();
    const pending = paced("https://api.plane.so/b", {
      signal: controller.signal,
    });
    controller.abort(new Error("stopped"));
    await expect(pending).rejects.toThrow("stopped");
    expect(inner).toHaveBeenCalledTimes(1);
  });
});
