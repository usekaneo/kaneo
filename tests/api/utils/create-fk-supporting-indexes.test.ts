import { describe, expect, it } from "vitest";
import { FK_SUPPORTING_INDEX_STATEMENTS } from "../../../apps/api/src/utils/create-fk-supporting-indexes";

describe("create-fk-supporting-indexes", () => {
  it("uses concurrent index creation for all FK-supporting indexes", () => {
    expect(FK_SUPPORTING_INDEX_STATEMENTS).toHaveLength(11);

    for (const statement of FK_SUPPORTING_INDEX_STATEMENTS) {
      expect(statement).toContain("CREATE INDEX CONCURRENTLY IF NOT EXISTS");
    }
  });
});
