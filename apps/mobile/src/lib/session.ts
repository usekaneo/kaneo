import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useState, useSyncExternalStore } from "react";

export type CredentialType = "bearer" | "apiKey";

export type Session = {
  serverUrl: string;
  credentialType: CredentialType;
  token: string;
  userId: string;
  userName: string;
  userEmail: string;
};

export type AppPreferences = {
  lastWorkspaceId: string | null;
  lastServerUrl: string | null;
  recentServers: string[];
  backgroundNotifications: boolean;
};

const SESSION_KEY = "kaneo.session";
const PREFS_KEY = "kaneo.prefs";

/** The token lives in the Keychain/Keystore. */
const secure = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};

const defaultPrefs: AppPreferences = {
  lastWorkspaceId: null,
  lastServerUrl: null,
  recentServers: [],
  backgroundNotifications: true,
};

type State = { ready: boolean; session: Session | null; prefs: AppPreferences };

let state: State = { ready: false, session: null, prefs: defaultPrefs };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const sessionStore = {
  get: () => state,
  subscribe,

  async hydrate() {
    const [rawSession, rawPrefs] = await Promise.all([
      secure.get(SESSION_KEY),
      AsyncStorage.getItem(PREFS_KEY),
    ]);
    let session: Session | null = null;
    let prefs = defaultPrefs;
    try {
      session = rawSession ? (JSON.parse(rawSession) as Session) : null;
    } catch {
      session = null;
    }
    try {
      prefs = rawPrefs
        ? {
            ...defaultPrefs,
            ...(JSON.parse(rawPrefs) as Partial<AppPreferences>),
          }
        : defaultPrefs;
    } catch {
      prefs = defaultPrefs;
    }
    set({ ready: true, session, prefs });
  },

  async save(session: Session) {
    await secure.set(SESSION_KEY, JSON.stringify(session));
    const recent = [
      session.serverUrl,
      ...state.prefs.recentServers.filter((s) => s !== session.serverUrl),
    ].slice(0, 5);
    await this.updatePrefs({
      lastServerUrl: session.serverUrl,
      recentServers: recent,
    });
    set({ session });
  },

  async updateUser(name: string, email: string) {
    if (!state.session) return;
    await this.save({ ...state.session, userName: name, userEmail: email });
  },

  async clear() {
    await secure.remove(SESSION_KEY);
    await this.updatePrefs({ lastWorkspaceId: null });
    set({ session: null });
  },

  async updatePrefs(patch: Partial<AppPreferences>) {
    const prefs = { ...state.prefs, ...patch };
    set({ prefs });
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  },
};

export function useSessionState(): State {
  return useSyncExternalStore(subscribe, sessionStore.get, sessionStore.get);
}

export function useSession(): Session | null {
  return useSessionState().session;
}

/**
 * For screens that only render while signed in. During sign-out the router unmounts them a frame
 * after the session clears, so the last known session covers that gap instead of crashing.
 */
export function useRequiredSession(): Session {
  const session = useSession();
  const [last, setLast] = useState(session);
  if (session && session !== last) setLast(session);
  const value = session ?? last;
  if (!value) throw new Error("Not signed in");
  return value;
}

export function usePrefs(): AppPreferences {
  return useSessionState().prefs;
}
