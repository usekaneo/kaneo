const NEW_SIGNUP_WINDOW_MS = 30 * 60 * 1000;

export function isNewSignup(createdAt: Date | string, now = Date.now()) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now - created >= 0 && now - created <= NEW_SIGNUP_WINDOW_MS;
}
