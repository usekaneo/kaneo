import { startOfflineSession } from "./offline-session";
import { startSavingSnapshot } from "./query-persister";

// Lets the installed app open and browse saved data without the server.
export function startOfflineMode() {
  startSavingSnapshot();
  startOfflineSession();

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }
}
