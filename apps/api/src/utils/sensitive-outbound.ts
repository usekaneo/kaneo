import { AsyncLocalStorage } from "node:async_hooks";

// Webhook and bot credentials may live in the URL path, so ordinary query/header
// redaction is insufficient. Scope automatic HTTP telemetry to the individual
// delivery rather than disabling tracing for unrelated concurrent requests.
const sensitiveDelivery = new AsyncLocalStorage<boolean>();
export function isSensitiveOutboundRequest() {
  return sensitiveDelivery.getStore() === true;
}
export function withoutOutboundTelemetry<T>(action: () => T): T {
  return sensitiveDelivery.run(true, action);
}
