import { describe, it, expect } from "vite-plus/test";
import { TypeID } from "typeid-js";
import {
  ensureTypeId,
  generateId,
  isValidTypeId,
  normalizeToUuid,
  toUuid,
} from "../core";
import {
  ID_PREFIXES,
  ID_PREFIX_ALIASES,
  isValidPrefix,
  resolvePrefix,
} from "../prefixes";
import { flexibleIdSchema, flexibleToTypeIdSchema, typeIdSchema } from "../zod";
import { pgTable } from "drizzle-orm/pg-core";
import {
  typeIdColumn,
  typeIdColumnNullable,
  typeIdTextColumn,
} from "../drizzle";

/**
 * Serialized prefixes that earlier releases emitted for entities whose prefix
 * has since been renamed. API clients and integrations store these ids, so
 * each one must keep resolving to the same row. Pinned by hand rather than
 * derived from ID_PREFIX_ALIASES so dropping an alias fails here.
 */
const RETIRED_PREFIXES: Record<string, keyof typeof ID_PREFIXES> = {
  kb_article: "kb_article",
  status: "post_status",
  tag: "post_tag",
  comment: "post_comment",
  vote: "post_vote",
  reaction: "post_comment_reaction",
  comment_edit: "post_comment_edit",
  note: "post_note",
  activity: "post_activity",
  merge_sug: "post_merge_suggestion",
  linked_entity: "post_external_link",
  chat_msg: "conversation_message",
  chat_tag: "conversation_tag",
  chat_msg_mention: "conversation_message_mention",
  category: "kb_category",
  article_feedback: "kb_article_feedback",
};

describe("retired ID prefixes", () => {
  it.each(Object.entries(RETIRED_PREFIXES))(
    "%s_ ids parse to the same uuid and canonicalise to %s",
    (retired, entity) => {
      const prefix = ID_PREFIXES[entity];
      const canonical = generateId(prefix);
      const uuid = toUuid(canonical);
      const legacy = TypeID.fromUUID(retired, uuid).toString();

      expect(isValidTypeId(legacy, prefix)).toBe(true);
      expect(normalizeToUuid(legacy, prefix)).toBe(uuid);
      expect(ensureTypeId(legacy, prefix)).toBe(canonical);
      expect(typeIdSchema(prefix).parse(legacy)).toBe(canonical);
      expect(flexibleIdSchema(prefix).parse(legacy)).toBe(uuid);
      expect(flexibleToTypeIdSchema(prefix).parse(legacy)).toBe(canonical);
      const table = pgTable("retired_prefix_test", {
        native: typeIdColumn(prefix)("native"),
        nullable: typeIdColumnNullable(prefix)("nullable"),
        text: typeIdTextColumn(prefix)("text"),
      });
      for (const column of [table.native, table.nullable, table.text]) {
        expect(column.mapToDriverValue(legacy)).toBe(uuid);
        expect(column.mapFromDriverValue(uuid)).toBe(canonical);
        expect(() => column.mapToDriverValue(generateId("board"))).toThrow();
      }
      expect(resolvePrefix(retired)).toBe(prefix);
    },
  );

  it("no alias shadows a current canonical prefix", () => {
    for (const alias of Object.keys(ID_PREFIX_ALIASES)) {
      expect(isValidPrefix(alias), alias).toBe(false);
    }
  });

  it("an alias is only accepted for its own entity", () => {
    const legacyTag = TypeID.fromUUID(
      "tag",
      toUuid(generateId("post_tag")),
    ).toString();
    expect(isValidTypeId(legacyTag, ID_PREFIXES.conversation_tag)).toBe(false);
    expect(() => ensureTypeId(legacyTag, ID_PREFIXES.post_status)).toThrow();
  });
});
