import { isTrackingEnabled, track } from "./track";

const SIGNUP_KEY = "kaneo:tracked-signup:";
const FIRST_TASK_KEY = "kaneo:first-task-pending";

export function trackSignup(user: {
  id: string;
  isAnonymous?: boolean | null;
}) {
  if (!isTrackingEnabled()) return;
  try {
    if (localStorage.getItem(SIGNUP_KEY + user.id)) return;
    localStorage.setItem(SIGNUP_KEY + user.id, "1");
    localStorage.setItem(FIRST_TASK_KEY, "1");
  } catch {
    return;
  }
  track("Signup", { props: { guest: Boolean(user.isAnonymous) } });
}

export function trackFirstTask() {
  if (!isTrackingEnabled()) return;
  try {
    if (!localStorage.getItem(FIRST_TASK_KEY)) return;
    localStorage.removeItem(FIRST_TASK_KEY);
  } catch {
    return;
  }
  track("First Task");
}
