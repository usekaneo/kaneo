import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import useRevokeAdminUserApiKey from "@/hooks/mutations/admin/use-revoke-admin-user-api-key";
import useRevokeAdminUserSession from "@/hooks/mutations/admin/use-revoke-admin-user-session";
import useRevokeAdminUserSessions from "@/hooks/mutations/admin/use-revoke-admin-user-sessions";
import useUserSessions, {
  USER_SESSIONS_QUERY_KEY,
} from "../user/use-user-sessions";
import { ADMIN_AUDIT_LOG_QUERY_KEY } from "./use-admin-audit-log";
import useAdminUserApiKeys, {
  adminUserApiKeysQueryKey,
} from "./use-admin-user-api-keys";
import useAdminUserSessions, {
  adminUserSessionsQueryKey,
} from "./use-admin-user-sessions";
import { ADMIN_USERS_QUERY_KEY } from "./use-admin-users";

const mocks = vi.hoisted(() => ({
  sessions: vi.fn(),
  keys: vi.fn(),
  ownSessions: vi.fn(),
  revokeOne: vi.fn(),
  revokeAll: vi.fn(),
  revokeKey: vi.fn(),
}));
vi.mock("@/fetchers/admin/get-admin-user-sessions", () => ({
  getAdminUserSessions: mocks.sessions,
}));
vi.mock("@/fetchers/admin/get-admin-user-api-keys", () => ({
  getAdminUserApiKeys: mocks.keys,
}));
vi.mock("@/fetchers/user/get-user-sessions", () => ({
  getUserSessions: mocks.ownSessions,
}));
vi.mock("@/fetchers/admin/revoke-admin-user-session", () => ({
  revokeAdminUserSession: mocks.revokeOne,
}));
vi.mock("@/fetchers/admin/revoke-admin-user-sessions", () => ({
  revokeAdminUserSessions: mocks.revokeAll,
}));
vi.mock("@/fetchers/admin/revoke-admin-user-api-key", () => ({
  revokeAdminUserApiKey: mocks.revokeKey,
}));

const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
    },
  });
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.resetAllMocks();
});

describe("security credential caches", () => {
  it("loads newly created credentials when cached lists are reopened", async () => {
    const { client, wrapper } = setup();
    const adminSessions = { sessions: [{ id: "new-admin-session" }] };
    const adminKeys = { apiKeys: [{ id: "new-key" }] };
    const ownSessions = { sessions: [{ id: "new-own-session" }] };
    client.setQueryData(adminUserSessionsQueryKey("target"), { sessions: [] });
    client.setQueryData(adminUserApiKeysQueryKey("target"), { apiKeys: [] });
    client.setQueryData(USER_SESSIONS_QUERY_KEY, { sessions: [] });
    mocks.sessions.mockResolvedValue(adminSessions);
    mocks.keys.mockResolvedValue(adminKeys);
    mocks.ownSessions.mockResolvedValue(ownSessions);

    renderHook(
      () => {
        useAdminUserSessions("target");
        useAdminUserApiKeys("target");
        useUserSessions();
      },
      { wrapper },
    );

    await waitFor(() => {
      expect(client.getQueryData(adminUserSessionsQueryKey("target"))).toEqual(
        adminSessions,
      );
      expect(client.getQueryData(adminUserApiKeysQueryKey("target"))).toEqual(
        adminKeys,
      );
      expect(client.getQueryData(USER_SESSIONS_QUERY_KEY)).toEqual(ownSessions);
    });
  });

  it.each(["one", "all", "key"] as const)(
    "updates an inactive audit log after revoking %s",
    async (kind) => {
      const { client, wrapper } = setup();
      const auditKey = [...ADMIN_AUDIT_LOG_QUERY_KEY, "admin", "", 1];
      const oldLog = { entries: [], total: 0 };
      const newLog = { entries: [{ id: "revocation" }], total: 1 };
      const fetchAudit = vi.fn().mockResolvedValue(oldLog);
      await client.fetchQuery({ queryKey: auditKey, queryFn: fetchAudit });
      fetchAudit.mockResolvedValue(newLog);
      mocks.revokeOne.mockResolvedValue({ revoked: 1 });
      mocks.revokeAll.mockResolvedValue({ revoked: 2 });
      mocks.revokeKey.mockResolvedValue({ revoked: 1 });
      const { result } = renderHook(
        () => {
          const one = useRevokeAdminUserSession();
          const all = useRevokeAdminUserSessions();
          const key = useRevokeAdminUserApiKey();
          return {
            one: () => one.mutateAsync({ userId: "target", sessionId: "old" }),
            all: () => all.mutateAsync("target"),
            key: () => key.mutateAsync({ userId: "target", apiKeyId: "old" }),
          };
        },
        { wrapper },
      );

      await act(async () => {
        await result.current[kind]();
      });

      expect(client.getQueryData(auditKey)).toEqual(newLog);
    },
  );

  it.each(["one", "all"] as const)(
    "refreshes last activity in an inactive user directory after revoking %s",
    async (kind) => {
      const { client, wrapper } = setup();
      const directoryKey = [...ADMIN_USERS_QUERY_KEY, "admin", "", 0, {}];
      const oldDirectory = {
        users: [{ id: "target", lastActiveAt: "2026-10-27T07:00:00Z" }],
        total: 1,
      };
      const newDirectory = {
        users: [
          {
            id: "target",
            lastActiveAt: kind === "all" ? null : "2026-10-26T07:00:00Z",
          },
        ],
        total: 1,
      };
      const fetchDirectory = vi.fn().mockResolvedValue(oldDirectory);
      await client.fetchQuery({
        queryKey: directoryKey,
        queryFn: fetchDirectory,
      });
      fetchDirectory.mockResolvedValue(newDirectory);
      mocks.revokeOne.mockResolvedValue({ revoked: 1 });
      mocks.revokeAll.mockResolvedValue({ revoked: 2 });
      const { result } = renderHook(
        () => {
          const one = useRevokeAdminUserSession();
          const all = useRevokeAdminUserSessions();
          return {
            one: () =>
              one.mutateAsync({ userId: "target", sessionId: "latest" }),
            all: () => all.mutateAsync("target"),
          };
        },
        { wrapper },
      );

      await act(async () => {
        await result.current[kind]();
      });

      expect(client.getQueryData(directoryKey)).toEqual(newDirectory);
    },
  );
});
