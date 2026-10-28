import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import {
  createRealtimeConnection,
  type RealtimeSocket,
} from "./realtime-connection";

class FakeSocket implements RealtimeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
}

function setup() {
  const sockets: FakeSocket[] = [];
  const events: unknown[] = [];
  const connection = createRealtimeConnection(
    () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    (event) => events.push(event),
  );
  return { sockets, events, connection };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createRealtimeConnection", () => {
  it("passes on events and skips keepalive replies and non-JSON frames", () => {
    const { sockets, events, connection } = setup();
    connection.start();
    sockets[0].onmessage?.({ data: '{"type":"pong"}' });
    sockets[0].onmessage?.({ data: "hello" });
    sockets[0].onmessage?.({ data: '{"type":"task.updated","taskId":"t1"}' });
    expect(events).toEqual([{ type: "task.updated", taskId: "t1" }]);
  });

  it("sends a keepalive while open", () => {
    const { sockets, connection } = setup();
    connection.start();
    sockets[0].onopen?.();
    vi.advanceTimersByTime(30_000);
    expect(sockets[0].sent).toEqual(['{"type":"ping"}']);
  });

  it("reconnects with backoff after the server closes the socket", () => {
    const { sockets, connection } = setup();
    connection.start();
    sockets[0].onclose?.();
    vi.advanceTimersByTime(1_999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it("ignores a late close from a stopped socket after restarting", () => {
    const { sockets, events, connection } = setup();
    connection.start();
    const old = sockets[0];
    const oldClose = old.onclose;
    const oldMessage = old.onmessage;
    connection.stop();
    expect(old.closed).toBe(true);

    connection.start();
    sockets[1].onopen?.();
    // The old socket's close event arrives after the new socket opened.
    oldClose?.();
    oldMessage?.({ data: '{"type":"task.updated"}' });
    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(2);
    expect(events).toEqual([]);
    // The new socket's keepalive survives.
    expect(sockets[1].sent).toEqual(['{"type":"ping"}', '{"type":"ping"}']);
  });

  it("cancels a pending reconnect when stopped", () => {
    const { sockets, connection } = setup();
    connection.start();
    sockets[0].onclose?.();
    connection.stop();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it("replaces a pending reconnect instead of adding a socket when started", () => {
    const { sockets, connection } = setup();
    connection.start();
    sockets[0].onclose?.();
    connection.start();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(2);
  });
});
