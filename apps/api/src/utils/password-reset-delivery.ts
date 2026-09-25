const pendingDeliveries = new Set<Promise<void>>();

export function trackPasswordResetDelivery(delivery: Promise<void>) {
  const settled = delivery
    .catch(() => {
      console.error("Password reset email preparation failed");
    })
    .finally(() => pendingDeliveries.delete(settled));
  pendingDeliveries.add(settled);
}

// HTTP responses must not wait on mail, but normal shutdown should give
// already accepted recovery requests time to finish delivery.
export async function drainPasswordResetDeliveries(timeoutMs = 10_000) {
  if (pendingDeliveries.size === 0) return;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        while (pendingDeliveries.size > 0) {
          await Promise.all([...pendingDeliveries]);
        }
      })(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(() => {
          console.warn("Timed out waiting for password reset email delivery");
          resolve();
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
