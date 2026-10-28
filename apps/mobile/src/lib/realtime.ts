import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { credentialHeaders } from "./api/client";
import {
  createRealtimeConnection,
  type RealtimeEvent,
  type RealtimeSocket,
} from "./realtime-connection";
import { useSession } from "./session";

export type { RealtimeEvent };

/**
 * Kaneo pushes change hints over WebSockets: `/api/ws/user` for notifications and access changes,
 * `/api/ws/{projectId}` for board updates. Native clients authenticate with the same bearer token
 * or API key. Reconnects with backoff, and only while the app is in the foreground.
 */
export function useRealtime(
  path: string | null,
  onEvent: (event: RealtimeEvent) => void,
) {
  const session = useSession();
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!session || !path) return;
    const connection = createRealtimeConnection(
      () => {
        // A per-connection windowId stops the server from treating this socket as the origin of
        // changes made by the same account elsewhere, which it would otherwise not echo.
        const windowId = `mobile-${Math.random().toString(36).slice(2)}`;
        const url = `${session.serverUrl.replace(/^http/, "ws")}/${path}?windowId=${windowId}`;
        // React Native's WebSocket accepts headers as a third argument; browsers ignore it.
        const Ctor = WebSocket as unknown as new (
          url: string,
          protocols?: string[] | null,
          options?: object,
        ) => RealtimeSocket;
        return new Ctor(url, null, { headers: credentialHeaders(session) });
      },
      (event) => handler.current(event),
    );
    let running = true;
    connection.start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !running) {
        running = true;
        connection.start();
      } else if (state === "background") {
        running = false;
        connection.stop();
      }
    });
    return () => {
      sub.remove();
      connection.stop();
    };
  }, [session, path]);
}
