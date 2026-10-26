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
    ended: [] as Array<{ id: string; userId: string }>,
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
  };
  return { rows, tx, db, deleteWhere, revokeSessionConnections: vi.fn() };
});

vi.mock("../../../apps/api/src/database", async () => ({
  default: mocks.db,
  schema: await import("../../../apps/api/src/database/schema"),
}));

vi.mock("../../../apps/api/src/ws", () => ({
  revokeSessionConnections: mocks.revokeSessionConnections,
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
  mocks.rows.ended = [{ id: "session-1", userId: "user-1" }];
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
    expect(mocks.revokeSessionConnections).not.toHaveBeenCalled();
  });

  it("ends sessions by session ID without looking up an account", async () => {
    await endProviderSessions({ ...TOKEN, sid: "kc-session-1" });

    expect(mocks.tx.select).not.toHaveBeenCalled();
    expect(mocks.deleteWhere).toHaveBeenCalledWith(expect.anything());
  });

  it("closes the connections of every session a subject logout ended", async () => {
    mocks.rows.ended = [
      { id: "session-1", userId: "user-1" },
      { id: "session-3", userId: "user-1" },
    ];

    await endProviderSessions({ ...TOKEN, sub: "kc-user-1" });

    expect(mocks.revokeSessionConnections).toHaveBeenCalledOnce();
    expect(mocks.revokeSessionConnections).toHaveBeenCalledWith("user-1", [
      "session-1",
      "session-3",
    ]);
  });

  it("closes the ended sessions' connections of each user", async () => {
    mocks.rows.ended = [
      { id: "session-1", userId: "user-1" },
      { id: "session-2", userId: "user-2" },
    ];

    await endProviderSessions({ ...TOKEN, sid: "kc-session-1" });

    expect(mocks.revokeSessionConnections).toHaveBeenCalledTimes(2);
    expect(mocks.revokeSessionConnections).toHaveBeenCalledWith("user-1", [
      "session-1",
    ]);
    expect(mocks.revokeSessionConnections).toHaveBeenCalledWith("user-2", [
      "session-2",
    ]);
  });

  it("logs, but does not fail, when closing connections fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.revokeSessionConnections.mockRejectedValueOnce(new Error("socket"));

    await expect(
      endProviderSessions({ ...TOKEN, sub: "kc-user-1" }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
  });
});
