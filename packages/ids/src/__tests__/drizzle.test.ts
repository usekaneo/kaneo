import { describe, expect, it } from "vite-plus/test";
import { pgTable } from "drizzle-orm/pg-core";
import { fromUuid, isValidTypeId, toUuid } from "../core";
import {
  typeIdColumn,
  typeIdColumnNullable,
  typeIdReference,
  typeIdTextColumn,
  typeIdWithDefault,
} from "../drizzle";
import { INVALID_TYPE_IDS, UUIDS } from "./fixtures";

const table = pgTable("ids_conversion_test", {
  native: typeIdColumn("post_comment")("native"),
  nullable: typeIdColumnNullable("post_comment")("nullable"),
  text: typeIdTextColumn("post_comment")("text"),
  generated: typeIdWithDefault("post_comment")("generated"),
  reference: typeIdReference("post_comment")("reference"),
});

describe.each(
  Object.entries({
    native: table.native,
    nullable: table.nullable,
    text: table.text,
    generated: table.generated,
    reference: table.reference,
  }),
)("%s driver conversions", (_name, column) => {
  it.each(UUIDS)(
    "preserves UUID storage and reads a canonical TypeID: %s",
    (uuid) => {
      const canonical = fromUuid("post_comment", uuid);
      expect(column.mapToDriverValue(canonical)).toBe(uuid.toLowerCase());
      expect(column.mapToDriverValue(uuid)).toBe(uuid);
      expect(column.mapFromDriverValue(uuid)).toBe(canonical);
      const retired = canonical.replace("post_comment_", "comment_");
      expect(column.mapToDriverValue(retired)).toBe(uuid.toLowerCase());
    },
  );

  it.each([
    "post_00000000000000000000000000",
    "tag_00000000000000000000000000",
    ...INVALID_TYPE_IDS,
    undefined,
    42,
  ])("rejects invalid or wrong-entity writes: %s", (value) => {
    expect(() => column.mapToDriverValue(value)).toThrow();
  });

  it.each(["invalid", "post_comment_00000000000000000000000000", 42])(
    "rejects invalid database values: %s",
    (value) => {
      expect(() => column.mapFromDriverValue(value)).toThrow();
    },
  );
});

it("preserves native versus text storage and UUIDv7 defaults", () => {
  expect(table.native.getSQLType()).toBe("uuid");
  expect(table.nullable.getSQLType()).toBe("uuid");
  expect(table.text.getSQLType()).toBe("text");
  const value = table.generated.defaultFn?.();
  expect(typeof value).toBe("string");
  if (typeof value !== "string") throw new Error("Expected a generated ID");
  expect(isValidTypeId(value, "post_comment")).toBe(true);
  expect(toUuid(value)[14]).toBe("7");
  expect(table.generated.mapToDriverValue(value)).toBe(toUuid(value));
});

it("preserves explicit nullable conversion behavior", () => {
  expect(table.nullable.mapToDriverValue(null)).toBeNull();
  expect(table.nullable.mapFromDriverValue(null)).toBeNull();
  expect(table.nullable.mapFromDriverValue(undefined)).toBeNull();
  for (const column of [table.native, table.text]) {
    expect(() => column.mapToDriverValue(null)).toThrow();
    expect(() => column.mapFromDriverValue(null)).toThrow();
    expect(() => column.mapFromDriverValue(undefined)).toThrow();
  }
});

it.each([
  "550E8400E29B41D4A716446655440000",
  "550e8400-e29b41d4-a716446655440000",
])("preserves native-column Better Auth compatibility: %s", (uuid) => {
  expect(table.native.mapToDriverValue(uuid)).toBe(uuid);
  expect(table.nullable.mapToDriverValue(uuid)).toBe(uuid);
  expect(() => table.text.mapToDriverValue(uuid)).toThrow();
});
