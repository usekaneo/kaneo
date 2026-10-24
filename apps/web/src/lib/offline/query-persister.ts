import { onlineManager } from "@tanstack/react-query";
import {
  type PersistedClient,
  type Persister,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/react-query-persist-client";
import queryClient from "@/query-client";
import { idbStore } from "./idb-store";
import { savedSessionUserId } from "./saved-session";

const KEY = "query-cache";

// How long a saved snapshot stays usable offline; older ones are dropped.
const MAX_AGE = 1000 * 60 * 60 * 24 * 7;

// Persisting serializes the whole cache, so coalesce bursts of updates
// (board drags, realtime events) into one write.
const WRITE_DELAY_MS = 1000;
let pending: ReturnType<typeof setTimeout> | undefined;

const persister: Persister = {
  persistClient: (client: PersistedClient) => {
    // Offline, the cache holds only the snapshot (or nothing, before it is
    // restored); writing it back could replace the snapshot with less.
    if (!onlineManager.isOnline()) return;
    clearTimeout(pending);
    pending = setTimeout(() => {
      idbStore.set(KEY, client).catch(() => undefined);
    }, WRITE_DELAY_MS);
  },
  restoreClient: () =>
    idbStore.get<PersistedClient>(KEY).catch(() => undefined),
  removeClient: () => {
    clearTimeout(pending);
    return idbStore.remove(KEY).catch(() => undefined);
  },
};

// Ties a snapshot to the user who saved it: anyone else's is discarded.
const options = () => ({
  queryClient,
  persister,
  maxAge: MAX_AGE,
  buster: savedSessionUserId(),
});

export const startSavingSnapshot = () => persistQueryClientSubscribe(options());

export const restoreSnapshot = () => persistQueryClientRestore(options());

export const removeSnapshot = () => persister.removeClient();
