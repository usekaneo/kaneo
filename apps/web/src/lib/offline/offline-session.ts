import queryClient from "@/query-client";
import { authClient } from "../auth-client";
import { goOffline, goOnline } from "./offline-state";
import { removeSnapshot } from "./query-persister";
import {
  readSavedSession,
  removeSavedSession,
  type SessionData,
  saveSession,
} from "./saved-session";

type SessionAtom = {
  data: SessionData | null;
  error: { status?: number } | null;
  isPending: boolean;
  isRefetching: boolean;
  refetch: () => Promise<unknown>;
};

// Watches the session to switch offline mode: a failed session request means
// the server is out of reach, so the app shows the saved session and data
// read-only until a request succeeds again. The API still checks every request.
export function startOfflineSession() {
  const atom = authClient.$store.atoms.session;
  if (!atom) return;
  let seeded: SessionData | null = null;

  atom.subscribe((value: SessionAtom) => {
    if (value.isPending || value.isRefetching) return;

    if (value.error?.status === 401 || (!value.data && !value.error)) {
      // Signed out: forget this user's data in memory and on the device.
      seeded = null;
      queryClient.clear();
      removeSavedSession();
      void removeSnapshot();
      return;
    }

    if (value.error) {
      // A rejected request (429, 403) means the server answered; only a
      // network failure or a gateway/server error means it is out of reach.
      const status = value.error.status;
      if (status && status < 500) return;
      const saved = value.data ?? readSavedSession();
      if (!saved) return;
      goOffline(() => value.refetch());
      seeded = saved;
      atom.set({ ...value, data: saved, error: null });
      return;
    }

    if (value.data && value.data !== seeded) {
      seeded = null;
      saveSession(value.data);
      goOnline();
    }
  });
}
