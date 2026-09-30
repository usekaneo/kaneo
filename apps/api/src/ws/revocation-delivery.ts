import type { BroadcastAdapter, UserBroadcast } from "./broadcast-adapter";

export function createRevocationDelivery(adapter: BroadcastAdapter) {
  type Pending = {
    message: UserBroadcast;
    shouldRetry?: () => Promise<boolean>;
  };
  const pending = new Map<string, Pending>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let delay = 1_000;

  const attempt = async (key: string, entry: Pending, retry = false) => {
    try {
      if (!retry || !entry.shouldRetry || (await entry.shouldRetry())) {
        if (stopped || pending.get(key) !== entry) return;
        await adapter.publishToUser(entry.message);
      }
      if (pending.get(key) === entry) pending.delete(key);
    } catch {
      // Membership is already removed. Keep the signal until Redis recovers.
    }
  };
  const schedule = () => {
    if (stopped || timer || !pending.size) return;
    timer = setTimeout(async () => {
      timer = undefined;
      await Promise.all(
        [...pending].map(([key, entry]) => attempt(key, entry, true)),
      );
      delay = pending.size ? Math.min(delay * 2, 30_000) : 1_000;
      schedule();
    }, delay);
    timer.unref();
  };
  return {
    async send(message: UserBroadcast, shouldRetry?: () => Promise<boolean>) {
      if (stopped) return;
      const key = JSON.stringify([message.userId, message.message.workspaceId]);
      const entry = { message, shouldRetry };
      pending.set(key, entry);
      await attempt(key, entry);
      schedule();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending.clear();
    },
  };
}
