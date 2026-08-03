import { describe, expect, it } from "vitest";
import { schema } from "../../../apps/api/src/database";

describe("configuration schema", () => {
  it("exports item type and saved view tables", () => {
    expect(schema.itemTypeTable).toBeDefined();
    expect(schema.savedViewTable).toBeDefined();
  });
});
