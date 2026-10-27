import { sendWebhookDelivery } from "./send-webhook-delivery";

export function startWebhookWorker() {
  let running: Promise<unknown> | null = null;
  const tick = () => {
    if (running) return;
    running = Promise.allSettled(
      Array.from({ length: 5 }, () => sendWebhookDelivery()),
    )
      .then((results) => {
        if (results.some((result) => result.status === "rejected")) {
          // Database errors may embed payloads and encrypted secrets.
          console.error("Instance webhook delivery worker failed");
        }
      })
      .finally(() => {
        running = null;
      });
  };
  const timer = setInterval(tick, 1_000);
  timer.unref();
  tick();
  return async () => {
    clearInterval(timer);
    await running;
  };
}
