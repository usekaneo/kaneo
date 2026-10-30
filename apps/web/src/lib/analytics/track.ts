export type AnalyticsEvent =
  | "Signup"
  | "Workspace Created"
  | "First Task"
  | "Invite Sent"
  | "Checkout Started"
  | "Subscribed";

export type TrackOptions = {
  props?: Record<string, string | number | boolean>;
};

declare global {
  interface Window {
    plausible?: (event: string, options?: TrackOptions) => void;
  }
}

export function isTrackingEnabled() {
  return (
    typeof window !== "undefined" && typeof window.plausible === "function"
  );
}

export function track(event: AnalyticsEvent, options?: TrackOptions) {
  if (!isTrackingEnabled()) return;
  try {
    window.plausible?.(event, options);
  } catch {}
}
