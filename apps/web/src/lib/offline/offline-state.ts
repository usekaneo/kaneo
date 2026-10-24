import { onlineManager } from "@tanstack/react-query";
import queryClient from "@/query-client";
import { restoreSnapshot } from "./query-persister";

const RETRY_MS = 30_000;

let offline = false;
let restored = false;
let retry: ReturnType<typeof setInterval> | undefined;

// The server is out of reach, even if the device has a network (a home
// server behind a VPN, say). Pausing onlineManager pauses queries and blocks
// changes; the saved snapshot fills the cache once per page load.
export function goOffline(checkServer: () => void) {
  onlineManager.setOnline(false);
  if (offline) return;
  offline = true;
  retry = setInterval(checkServer, RETRY_MS);
  if (!restored) {
    restored = true;
    void restoreSnapshot().catch(() => undefined);
  }
}

export function goOnline() {
  if (!offline) return;
  offline = false;
  clearInterval(retry);
  onlineManager.setOnline(true);
  // Queries don't refetch on mount, so drop the snapshot data no screen uses
  // and refetch the rest instead of showing it as current.
  queryClient.removeQueries({ type: "inactive" });
  void queryClient.invalidateQueries();
}
