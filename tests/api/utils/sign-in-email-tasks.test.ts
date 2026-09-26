import { afterEach, describe, expect, it, vi } from "vitest";
import {
  drainSignInEmails,
  queueSignInEmail,
} from "../../../apps/api/src/utils/sign-in-email-tasks";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("background sign-in emails", () => {
  it("returns before eligibility or delivery finishes and drains pending work", async () => {
    let release!: () => void;
    const deliver = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    expect(queueSignInEmail(deliver)).toBeUndefined();
    expect(deliver).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(deliver).toHaveBeenCalledOnce();
    let drained = false;
    const draining = drainSignInEmails().then((complete) => {
      drained = complete;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    release();
    await draining;
    expect(drained).toBe(true);
  });

  it.each([false, true])(
    "handles delivery failures without logging sensitive details (sync: %s)",
    async (sync) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      queueSignInEmail(() => {
        const error = new Error(
          "smtp-secret token=123456 recipient@example.com",
        );
        if (sync) throw error;
        return Promise.reject(error);
      });
      expect(await drainSignInEmails()).toBe(true);
      expect(log).toHaveBeenCalledExactlyOnceWith(
        "Sign-in email delivery failed",
      );
    },
  );

  it("bounds shutdown waiting without discarding the pending send", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    queueSignInEmail(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const draining = drainSignInEmails(100);
    await vi.advanceTimersByTimeAsync(100);
    expect(await draining).toBe(false);
    release();
    expect(await drainSignInEmails()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
