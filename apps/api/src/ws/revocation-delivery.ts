import type { BroadcastAdapter, UserBroadcast } from "./broadcast-adapter";

export function createRevocationDelivery(adapter: BroadcastAdapter) {
  const pending = new Map<string, UserBroadcast>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let delay = 1_000;

  const attempt = async (key: string, message: UserBroadcast) => {
    try {
      await adapter.publishToUser(message);
      if (pending.get(key) === message) pending.delete(key);
    } catch {
      // Membership is already removed. Keep the signal until Redis recovers.
    }
  };
  const schedule = () => {
    if (stopped || timer || !pending.size) return;
    timer = setTimeout(async () => {
      timer = undefined;
      await Promise.all(
        [...pending].map(([key, message]) => attempt(key, message)),
      );
      delay = pending.size ? Math.min(delay * 2, 30_000) : 1_000;
      schedule();
    }, delay);
    timer.unref();
  };
  return {
    async send(message: UserBroadcast) {
      if (stopped) return;
      const key = JSON.stringify([message.userId, message.message.workspaceId]);
      pending.set(key, message);
      await attempt(key, message);
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
