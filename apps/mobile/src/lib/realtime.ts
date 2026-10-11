import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { credentialHeaders } from "./api/client";
import { useSession } from "./session";

export type RealtimeEvent = {
  type: string;
  projectId?: string;
  taskId?: string;
};

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
    let socket: WebSocket | null = null;
    let keepAlive: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      // A per-connection windowId stops the server from treating this socket as the origin of
      // changes made by the same account elsewhere, which it would otherwise not echo.
      const windowId = `mobile-${Math.random().toString(36).slice(2)}`;
      const url = `${session.serverUrl.replace(/^http/, "ws")}/${path}?windowId=${windowId}`;
      // React Native's WebSocket accepts headers as a third argument; browsers ignore it.
      const Ctor = WebSocket as unknown as new (
        url: string,
        protocols?: string[] | null,
        options?: object,
      ) => WebSocket;
      socket = new Ctor(url, null, { headers: credentialHeaders(session) });
      socket.onopen = () => {
        attempt = 0;
        // The server only accepts this exact text keepalive.
        keepAlive = setInterval(() => socket?.send('{"type":"ping"}'), 30_000);
      };
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(String(message.data)) as RealtimeEvent;
          if (data?.type && data.type !== "PING" && data.type !== "pong")
            handler.current(data);
        } catch {
          // Ignore non-JSON frames.
        }
      };
      socket.onclose = () => {
        if (keepAlive) clearInterval(keepAlive);
        keepAlive = null;
        if (stopped) return;
        attempt += 1;
        retry = setTimeout(connect, Math.min(30_000, 2_000 * attempt));
      };
      socket.onerror = () => socket?.close();
    };

    const stop = () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      if (keepAlive) clearInterval(keepAlive);
      socket?.close();
      socket = null;
    };

    connect();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && stopped) {
        stopped = false;
        attempt = 0;
        connect();
      } else if (state === "background") {
        stop();
      }
    });
    return () => {
      sub.remove();
      stop();
    };
  }, [session, path]);
}
