import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => {
  const rows = {
    claimed: [] as Array<{ id: string }>,
    accounts: [] as Array<{ userId: string }>,
    ended: [] as Array<{ userId: string }>,
    activeSessions: [] as Array<{ id: string }>,
  };
  const deleteWhere = vi.fn(() => ({ returning: async () => rows.ended }));
  const tx = {
    insert: vi.fn(() => ({
      values: () => ({
        onConflictDoNothing: () => ({ returning: async () => rows.claimed }),
      }),
    })),
    select: vi.fn(() => ({
      from: () => ({ where: async () => rows.accounts }),
    })),
    delete: vi.fn(() => ({ where: deleteWhere })),
  };
  const db = {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => rows.activeSessions }),
      }),
    })),
  };
  return { rows, tx, db, deleteWhere, revokeUserConnections: vi.fn() };
});

vi.mock("../../../apps/api/src/database", async () => ({
  default: mocks.db,
  schema: await import("../../../apps/api/src/database/schema"),
}));

vi.mock("../../../apps/api/src/ws", () => ({
  revokeUserConnections: mocks.revokeUserConnections,
}));

import { endProviderSessions } from "../../../apps/api/src/backchannel-logout/controllers/end-provider-sessions";
import { LogoutTokenRejected } from "../../../apps/api/src/backchannel-logout/errors";

const TOKEN = {
  iss: "https://idp.example.com/realms/kaneo",
  jti: "logout-1",
  iat: 1_792_315_200,
};

beforeEach(() => {
  mocks.rows.claimed = [{ id: "claim" }];
  mocks.rows.accounts = [{ userId: "user-1" }];
  mocks.rows.ended = [{ userId: "user-1" }];
  mocks.rows.activeSessions = [];
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("endProviderSessions", () => {
  it("refuses a logout without a session ID or subject before any query", async () => {
    await expect(endProviderSessions(TOKEN)).rejects.toThrow(
      "A logout needs a session ID or a subject",
    );
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("rejects a token that was used before and ends nothing", async () => {
    mocks.rows.claimed = [];

    await expect(
      endProviderSessions({ ...TOKEN, sub: "kc-user-1" }),
    ).rejects.toBeInstanceOf(LogoutTokenRejected);
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it("ends nothing for a subject without a Kaneo account", async () => {
    mocks.rows.accounts = [];

    await endProviderSessions({
      ...TOKEN,
      sid: "kc-session-1",
      sub: "kc-user-9",
    });

    expect(mocks.tx.insert).toHaveBeenCalledOnce();
    expect(mocks.tx.delete).not.toHaveBeenCalled();
    expect(mocks.revokeUserConnections).not.toHaveBeenCalled();
  });

  it("ends sessions by session ID without looking up an account", async () => {
    await endProviderSessions({ ...TOKEN, sid: "kc-session-1" });

    expect(mocks.tx.select).not.toHaveBeenCalled();
    expect(mocks.deleteWhere).toHaveBeenCalledWith(expect.anything());
  });

  it("closes the realtime connections of users without a session left", async () => {
    mocks.rows.ended = [{ userId: "user-1" }, { userId: "user-1" }];

    await endProviderSessions({ ...TOKEN, sub: "kc-user-1" });

    expect(mocks.revokeUserConnections).toHaveBeenCalledOnce();
    expect(mocks.revokeUserConnections).toHaveBeenCalledWith("user-1");
  });

  it("keeps the connections of users who still have a session", async () => {
    mocks.rows.activeSessions = [{ id: "session-2" }];

    await endProviderSessions({ ...TOKEN, sid: "kc-session-1" });

    expect(mocks.revokeUserConnections).not.toHaveBeenCalled();
  });

  it("logs, but does not fail, when closing connections fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.revokeUserConnections.mockRejectedValueOnce(new Error("socket"));

    await expect(
      endProviderSessions({ ...TOKEN, sub: "kc-user-1" }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
  });
});
