import { atom } from "nanostores";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { startOfflineSession } from "./offline-session";

const { session, goOffline, goOnline, removeSnapshot, clear } = vi.hoisted(
  () => ({
    session: { current: undefined as unknown },
    goOffline: vi.fn(),
    goOnline: vi.fn(),
    removeSnapshot: vi.fn(),
    clear: vi.fn(),
  }),
);

vi.mock("../auth-client", () => ({
  authClient: {
    $store: {
      atoms: {
        get session() {
          return session.current;
        },
      },
    },
  },
}));
vi.mock("./offline-state", () => ({ goOffline, goOnline }));
vi.mock("./query-persister", () => ({ removeSnapshot }));
vi.mock("@/query-client", () => ({ default: { clear } }));

const user = { id: "user-1", name: "Ada" };
const fetched = {
  user,
  session: { id: "s1", token: "secret", activeOrganizationId: "ws-1" },
};
const idle = {
  data: null,
  error: null,
  isPending: false,
  isRefetching: false,
  refetch: vi.fn(),
};

function start() {
  const store = atom<typeof idle & Record<string, unknown>>({
    ...idle,
    isPending: true,
  });
  session.current = store;
  startOfflineSession();
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("startOfflineSession", () => {
  it("saves a fetched session without its token", () => {
    const store = start();
    store.set({ ...idle, data: fetched });

    const saved = JSON.parse(localStorage.getItem("kaneo:offline-session")!);
    expect(saved.session).toEqual({ id: "s1", activeOrganizationId: "ws-1" });
    expect(saved.user).toEqual(user);
    expect(goOnline).toHaveBeenCalled();
  });

  it("shows the saved session read-only when the server is out of reach", () => {
    const store = start();
    store.set({ ...idle, data: fetched });
    store.set({ ...idle, isPending: true });
    store.set({ ...idle, error: new TypeError("Failed to fetch") });

    expect(goOffline).toHaveBeenCalledOnce();
    expect(store.get().error).toBeNull();
    expect(store.get().data).toMatchObject({ user, session: { id: "s1" } });
  });

  it("treats a 401 as signed out and forgets the user's data", () => {
    const store = start();
    store.set({ ...idle, data: fetched });
    store.set({ ...idle, error: { status: 401 } });

    expect(goOffline).not.toHaveBeenCalled();
    expect(store.get().data).toBeNull();
    expect(localStorage.getItem("kaneo:offline-session")).toBeNull();
    expect(removeSnapshot).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
  });

  it("stays online when the server answers with a client error", () => {
    const store = start();
    store.set({ ...idle, data: fetched });
    store.set({ ...idle, error: { status: 429 } });

    expect(goOffline).not.toHaveBeenCalled();
    expect(store.get().error).toEqual({ status: 429 });
  });
});
