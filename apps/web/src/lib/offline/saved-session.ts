import type { authClient } from "../auth-client";

const KEY = "kaneo:offline-session";

export type SessionData = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>["data"]
>;

export function readSavedSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

export const savedSessionUserId = () => readSavedSession()?.user.id ?? "";

export function saveSession(data: SessionData) {
  // The token stays in the HTTP-only cookie; the offline copy only needs to
  // identify the user and the active workspace.
  const { token: _token, ...session } = data.session;
  try {
    localStorage.setItem(KEY, JSON.stringify({ user: data.user, session }));
  } catch {
    // Storage full or blocked: the app still works online.
  }
}

export function removeSavedSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing saved to remove.
  }
}
