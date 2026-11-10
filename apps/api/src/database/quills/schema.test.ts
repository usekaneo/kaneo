import { describe, expect, it } from "vite-plus/test";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "./schema";
const tables = Object.values(schema).filter((value) => is(value, PgTable));
describe("Quills schema ownership", () => {
  it("keeps every feature table tenant-scoped and outside Kaneo's namespace", () => {
    expect(tables.length).toBe(147);
    for (const table of tables) {
      const config = getTableConfig(table);
      expect(config.schema, config.name).toBe("quills");
      expect(config.enableRLS, config.name).toBe(true);
      expect(
        config.policies.map((policy) => policy.name),
        config.name,
      ).toContain("workspace_isolation");
      expect(
        config.columns.find((column) => column.name === "workspace_id")
          ?.notNull,
        config.name,
      ).toBe(true);
      for (const key of [...config.primaryKeys, ...config.uniqueConstraints])
        expect(key.columns[0]?.name, config.name).toBe("workspace_id");
      for (const index of config.indexes.filter(
        (entry) => entry.config.unique,
      )) {
        const first = index.config.columns[0];
        expect(
          first && "name" in first ? first.name : undefined,
          index.config.name,
        ).toBe("workspace_id");
      }
      for (const fk of config.foreignKeys) {
        const ref = fk.reference();
        if (getTableConfig(ref.foreignTable).schema !== "quills") continue;
        expect(ref.columns[0]?.name, config.name).toBe("workspace_id");
        expect(ref.foreignColumns[0]?.name, config.name).toBe("workspace_id");
      }
    }
  });
  it("does not duplicate Kaneo authentication tables", () => {
    const names = tables.map((table) => getTableConfig(table).name);
    for (const name of [
      "user",
      "session",
      "account",
      "verification",
      "two_factor",
      "invitation",
      "sso_recovery_code",
    ])
      expect(names).not.toContain(name);
  });
});
