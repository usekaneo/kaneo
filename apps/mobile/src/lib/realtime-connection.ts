export type RealtimeEvent = {
  type: string;
  projectId?: string;
  taskId?: string;
};

/** The part of WebSocket the connection uses, so tests can pass a fake. */
export type RealtimeSocket = {
  onopen: (() => void) | null;
  onmessage: ((message: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
};

function parseEvent(data: unknown): RealtimeEvent | null {
  try {
    const event = JSON.parse(String(data)) as RealtimeEvent;
    return event?.type && event.type !== "PING" && event.type !== "pong"
      ? event
      : null;
  } catch {
    // Ignore non-JSON frames.
    return null;
  }
}

/**
 * Keeps one socket open between `start()` and `stop()`, reconnecting with backoff. Each socket
 * owns its keepalive, and `stop()` detaches its handlers, so a close event that arrives late
 * (common on iOS after a quick app switch) cannot touch the next socket or open a second one.
 */
export function createRealtimeConnection(
  openSocket: () => RealtimeSocket,
  onEvent: (event: RealtimeEvent) => void,
) {
  let current: { socket: RealtimeSocket; dispose: () => void } | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const connect = () => {
    const socket = openSocket();
    let keepAlive: ReturnType<typeof setInterval> | null = null;
    const dispose = () => {
      if (keepAlive) clearInterval(keepAlive);
      keepAlive = null;
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    };
    current = { socket, dispose };
    socket.onopen = () => {
      attempt = 0;
      // The server only accepts this exact text keepalive.
      keepAlive = setInterval(() => socket.send('{"type":"ping"}'), 30_000);
    };
    socket.onmessage = (message) => {
      if (current?.socket !== socket) return;
      const event = parseEvent(message.data);
      if (event) onEvent(event);
    };
    socket.onclose = () => {
      dispose();
      if (current?.socket !== socket) return;
      current = null;
      attempt += 1;
      retry = setTimeout(
        () => {
          retry = null;
          connect();
        },
        Math.min(30_000, 2_000 * attempt),
      );
    };
    socket.onerror = () => socket.close();
  };

  const stop = () => {
    if (retry) clearTimeout(retry);
    retry = null;
    const last = current;
    current = null;
    last?.dispose();
    last?.socket.close();
  };

  return {
    start() {
      stop();
      attempt = 0;
      connect();
    },
    stop,
  };
}
