const ERROR_KEYS: Record<string, string> = {
  network: "settings:adminWebhooks.errors.network",
  timeout: "settings:adminWebhooks.errors.timeout",
  http: "settings:adminWebhooks.errors.http",
  destination: "settings:adminWebhooks.errors.destination",
  signing: "settings:adminWebhooks.errors.signing",
  disabled: "settings:adminWebhooks.errors.disabled",
  interrupted: "settings:adminWebhooks.errors.interrupted",
  response: "settings:adminWebhooks.errors.response",
};
export function getWebhookErrorLabel(code: string, t: (key: string) => string) {
  return t(ERROR_KEYS[code] ?? "settings:adminWebhooks.failed");
}
