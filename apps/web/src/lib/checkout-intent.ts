const KEY = "kaneo:pending-checkout";

const VALID = new Set([
  "personal-monthly",
  "personal-annual",
  "team-monthly",
  "team-annual",
]);

export type CheckoutIntent = {
  plan: "personal" | "team";
  interval: "monthly" | "annual";
};

/**
 * Reads a `?checkout=<plan>-<interval>` param from the current URL and stores
 * it. Called once at app boot, before the router runs: the sign-up →
 * onboarding → workspace redirect chain drops query params, so the value has
 * to be captured synchronously on first load.
 */
export function captureCheckoutIntent() {
  if (typeof window === "undefined") return;
  try {
    const value = new URLSearchParams(window.location.search).get("checkout");
    if (value && VALID.has(value)) {
      localStorage.setItem(KEY, value);
    }
  } catch {}
}

export function readCheckoutIntent(): CheckoutIntent | null {
  try {
    const value = localStorage.getItem(KEY);
    if (!value || !VALID.has(value)) return null;
    const [plan, interval] = value.split("-");
    return {
      plan: plan as CheckoutIntent["plan"],
      interval: interval as CheckoutIntent["interval"],
    };
  } catch {
    return null;
  }
}

export function clearCheckoutIntent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
