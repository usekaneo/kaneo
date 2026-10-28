import { describe, expect, it, vi } from "vite-plus/test";
import type db from "../../../apps/api/src/database";

const { defaultSelect } = vi.hoisted(() => ({
  defaultSelect: vi.fn(() => {
    throw new Error("Unexpected global database access");
  }),
}));
vi.mock("../../../apps/api/src/database", async () => ({
  default: { select: defaultSelect },
  schema: await import("../../../apps/api/src/database/schema"),
}));

import { canReceiveResourceNotification } from "../../../apps/api/src/notification/resource-access";

type RecipientRow = {
  id: string;
  instanceRole: string;
  memberRole: string | null;
  storedRole: string | null;
  permission: string | null;
};

function injectedDatabase(rows: RecipientRow[]) {
  const query = {
    from: () => query,
    leftJoin: () => query,
    where: async () => rows,
  };
  const select = vi.fn(() => query);
  return {
    select,
    database: { select } as unknown as Pick<typeof db, "select">,
  };
}

const member = {
  id: "user",
  instanceRole: "user",
  memberRole: "limited",
  storedRole: "limited",
};

describe("notification recipient current grants", () => {
  it("batches stored role statements into the injected recipient check", async () => {
    const { database, select } = injectedDatabase([
      { ...member, memberRole: "limited, reader", permission: "{}" },
      {
        ...member,
        memberRole: "limited, reader",
        storedRole: "reader",
        permission: '{"task":["read"]}',
      },
    ]);
    expect(
      await canReceiveResourceNotification("user", "task", "task", database),
    ).toBe(true);
    expect(select).toHaveBeenCalledTimes(1);
    expect(defaultSelect).not.toHaveBeenCalled();
  });

  it.each(["task", "workspace"])(
    "requires the current %s read grant",
    async (resourceType) => {
      for (const permissions of [{}, { label: ["read"] }]) {
        const { database, select } = injectedDatabase([
          { ...member, permission: JSON.stringify(permissions) },
        ]);
        expect(
          await canReceiveResourceNotification(
            "user",
            "resource",
            resourceType,
            database,
          ),
        ).toBe(false);
        expect(select).toHaveBeenCalledTimes(1);
      }
      const { database } = injectedDatabase([
        { ...member, permission: JSON.stringify({ [resourceType]: ["read"] }) },
      ]);
      expect(
        await canReceiveResourceNotification(
          "user",
          "resource",
          resourceType,
          database,
        ),
      ).toBe(true);
    },
  );

  it("preserves built-in fallback and user-only notifications", async () => {
    const fallback = injectedDatabase([
      { ...member, memberRole: "viewer", storedRole: null, permission: null },
    ]);
    expect(
      await canReceiveResourceNotification(
        "user",
        "task",
        "task",
        fallback.database,
      ),
    ).toBe(true);
    const personal = injectedDatabase([
      { ...member, memberRole: null, storedRole: null, permission: null },
    ]);
    expect(
      await canReceiveResourceNotification(
        "user",
        null,
        null,
        personal.database,
      ),
    ).toBe(true);
    const missing = injectedDatabase([]);
    expect(
      await canReceiveResourceNotification(
        "missing",
        null,
        null,
        missing.database,
      ),
    ).toBe(false);
  });
});
