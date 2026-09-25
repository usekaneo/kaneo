import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  drainPasswordResetDeliveries,
  trackPasswordResetDelivery,
} from "../../../apps/api/src/utils/password-reset-delivery";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("waits for pending delivery without delaying the HTTP callback", async () => {
  const delivery = Promise.withResolvers<void>();
  expect(trackPasswordResetDelivery(delivery.promise)).toBeUndefined();
  const drained = vi.fn();
  const drain = drainPasswordResetDeliveries().then(drained);
  await vi.advanceTimersByTimeAsync(1);
  expect(drained).not.toHaveBeenCalled();
  delivery.resolve();
  await drain;
  expect(drained).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("also drains deliveries registered while waiting", async () => {
  const first = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  trackPasswordResetDelivery(first.promise);
  const drained = vi.fn();
  const drain = drainPasswordResetDeliveries().then(drained);
  trackPasswordResetDelivery(second.promise);
  first.resolve();
  await vi.advanceTimersByTimeAsync(1);
  expect(drained).not.toHaveBeenCalled();
  second.resolve();
  await drain;
});

it("bounds shutdown when the mail server does not respond", async () => {
  const delivery = Promise.withResolvers<void>();
  trackPasswordResetDelivery(delivery.promise);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const drain = drainPasswordResetDeliveries(100);
  await vi.advanceTimersByTimeAsync(100);
  await drain;
  expect(warning).toHaveBeenCalledWith(
    "Timed out waiting for password reset email delivery",
  );
  delivery.resolve();
  await drainPasswordResetDeliveries();
});

it("handles rejected preparation without leaking private error details", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  trackPasswordResetDelivery(Promise.reject(new Error("private-reset-token")));
  await drainPasswordResetDeliveries();
  expect(log).toHaveBeenCalledExactlyOnceWith(
    "Password reset email preparation failed",
  );
  expect(vi.getTimerCount()).toBe(0);
});
