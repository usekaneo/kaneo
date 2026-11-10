import { describe, it, expect } from "vite-plus/test";
import {
  generateId,
  createId,
  toUuid,
  fromUuid,
  parseTypeId,
  getTypeIdPrefix,
  isValidTypeId,
  isTypeId,
  isUuid,
  isTypeIdFormat,
  batchFromUuid,
  batchToUuid,
  normalizeToUuid,
  ensureTypeId,
  typeIdLookupKeys,
} from "../core";
import {
  ID_PREFIXES,
  isValidPrefix,
  prefixMatches,
  resolvePrefix,
} from "../prefixes";
import { INVALID_TYPE_IDS, UUIDS } from "./fixtures";

describe("TypeID Core", () => {
  describe("generateId", () => {
    it("generates a valid TypeID with the correct prefix", () => {
      const id = generateId("post");
      expect(id).toMatch(/^post_[0-7][0-9a-hjkmnp-tv-z]{25}$/);
    });

    it("generates unique IDs on each call", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId("post"));
      }
      expect(ids.size).toBe(1000);
    });

    it("generates IDs with different prefixes", () => {
      const postId = generateId("post");
      const boardId = generateId("board");
      const commentId = generateId("post_comment");

      expect(postId).toMatch(/^post_/);
      expect(boardId).toMatch(/^board_/);
      expect(commentId).toMatch(/^post_comment_/);
    });

    it("generates time-ordered IDs (UUIDv7)", () => {
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(generateId("post"));
      }

      // IDs should be in lexicographic order (time-sorted)
      const sorted = [...ids].sort();
      expect(ids).toEqual(sorted);
    });
  });

  describe("createId", () => {
    it("creates ID using entity type key", () => {
      const postId = createId("post");
      const boardId = createId("board");

      expect(postId).toMatch(/^post_/);
      expect(boardId).toMatch(/^board_/);
    });

    it("works with all entity types", () => {
      for (const entityType of Object.keys(ID_PREFIXES) as Array<
        keyof typeof ID_PREFIXES
      >) {
        const id = createId(entityType);
        expect(id).toMatch(new RegExp(`^${ID_PREFIXES[entityType]}_`));
      }
    });
  });

  describe("toUuid", () => {
    it("extracts UUID from TypeID", () => {
      const typeId = generateId("post");
      const uuid = toUuid(typeId);

      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("throws on invalid TypeID format", () => {
      expect(() => toUuid("invalid")).toThrow();
      expect(() => toUuid("post_invalid")).toThrow();
      expect(() => toUuid("")).toThrow();
    });
  });

  describe("fromUuid", () => {
    it("creates TypeID from UUID", () => {
      const uuid = "01893d8c-7e80-7000-8000-000000000000";
      const typeId = fromUuid("post", uuid);

      expect(typeId).toMatch(/^post_/);
      expect(toUuid(typeId)).toBe(uuid);
    });

    it("throws on invalid UUID format", () => {
      expect(() => fromUuid("post", "invalid")).toThrow("Invalid UUID format");
      expect(() => fromUuid("post", "01893d8c-7e80-7000")).toThrow();
      expect(() => fromUuid("post", "")).toThrow();
    });

    it("works with uppercase UUIDs", () => {
      const uuid = "01893D8C-7E80-7000-8000-000000000000";
      const typeId = fromUuid("post", uuid);
      expect(typeId).toMatch(/^post_/);
    });
  });

  describe("round-trip conversion", () => {
    it("preserves ID through UUID round-trip", () => {
      const original = generateId("post");
      const uuid = toUuid(original);
      const restored = fromUuid("post", uuid);

      expect(restored).toBe(original);
    });

    it("works for all entity types", () => {
      for (const entityType of Object.keys(ID_PREFIXES) as Array<
        keyof typeof ID_PREFIXES
      >) {
        const original = createId(entityType);
        const uuid = toUuid(original);
        const restored = fromUuid(ID_PREFIXES[entityType], uuid);
        expect(restored).toBe(original);
      }
    });
  });

  describe("parseTypeId", () => {
    it("extracts prefix and UUID", () => {
      const typeId = generateId("post");
      const { prefix, uuid } = parseTypeId(typeId);

      expect(prefix).toBe("post");
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("works with different prefixes", () => {
      const prefixes = [
        "post",
        "board",
        "post_comment",
        "workspace",
        "user",
      ] as const;

      for (const prefix of prefixes) {
        const typeId = generateId(prefix);
        const parsed = parseTypeId(typeId);
        expect(parsed.prefix).toBe(prefix);
      }
    });
  });

  describe("getTypeIdPrefix", () => {
    it("returns the prefix", () => {
      const typeId = generateId("board");
      expect(getTypeIdPrefix(typeId)).toBe("board");
    });
  });

  describe("isValidTypeId", () => {
    it("returns true for valid TypeIDs", () => {
      expect(isValidTypeId(generateId("post"))).toBe(true);
      expect(isValidTypeId(generateId("board"))).toBe(true);
    });

    it("returns false for invalid formats", () => {
      expect(isValidTypeId("invalid")).toBe(false);
      expect(isValidTypeId("post_invalid")).toBe(false);
      expect(isValidTypeId("")).toBe(false);
      expect(isValidTypeId("01893d8c-7e80-7000-8000-000000000000")).toBe(false);
    });

    it("validates prefix when specified", () => {
      const postId = generateId("post");

      expect(isValidTypeId(postId, "post")).toBe(true);
      expect(isValidTypeId(postId, "board")).toBe(false);
    });
  });

  describe("isUuid", () => {
    it("returns true for valid UUIDs", () => {
      expect(isUuid("01893d8c-7e80-7000-8000-000000000000")).toBe(true);
      expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    });

    it("returns false for invalid formats", () => {
      expect(isUuid("invalid")).toBe(false);
      expect(isUuid("post_01h455vb4pex5vsknk084sn02q")).toBe(false);
      expect(isUuid("550e8400-e29b-41d4-a716")).toBe(false);
      expect(isUuid("")).toBe(false);
    });
  });

  describe("isTypeIdFormat", () => {
    it("returns true for TypeID-like strings", () => {
      expect(isTypeIdFormat(generateId("post"))).toBe(true);
      expect(isTypeIdFormat(generateId("board"))).toBe(true);
    });

    it("returns false for non-TypeID formats", () => {
      expect(isTypeIdFormat("invalid")).toBe(false);
      expect(isTypeIdFormat("01893d8c-7e80-7000-8000-000000000000")).toBe(
        false,
      );
    });
  });

  describe("batchFromUuid", () => {
    it("converts multiple UUIDs to TypeIDs", () => {
      const uuids = [
        "01893d8c-7e80-7000-8000-000000000001",
        "01893d8c-7e80-7000-8000-000000000002",
        "01893d8c-7e80-7000-8000-000000000003",
      ];

      const typeIds = batchFromUuid("post", uuids);

      expect(typeIds).toHaveLength(3);
      typeIds.forEach((id, i) => {
        expect(id).toMatch(/^post_/);
        expect(toUuid(id)).toBe(uuids[i]);
      });
    });

    it("returns empty array for empty input", () => {
      expect(batchFromUuid("post", [])).toEqual([]);
    });
  });

  describe("batchToUuid", () => {
    it("converts multiple TypeIDs to UUIDs", () => {
      const typeIds = [
        generateId("post"),
        generateId("post"),
        generateId("post"),
      ];

      const uuids = batchToUuid(typeIds);

      expect(uuids).toHaveLength(3);
      uuids.forEach((uuid) => {
        expect(uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      });
    });
  });

  describe("normalizeToUuid", () => {
    it("passes through UUIDs unchanged", () => {
      const uuid = "01893d8c-7e80-7000-8000-000000000000";
      expect(normalizeToUuid(uuid)).toBe(uuid);
    });

    it("extracts UUID from TypeID", () => {
      const typeId = generateId("post");
      const uuid = normalizeToUuid(typeId);
      expect(uuid).toBe(toUuid(typeId));
    });

    it("validates prefix when specified", () => {
      const postId = generateId("post");
      expect(normalizeToUuid(postId, "post")).toBe(toUuid(postId));
      expect(() => normalizeToUuid(postId, "board")).toThrow(
        "Expected board ID, got post",
      );
    });
  });

  describe("ensureTypeId", () => {
    it("converts UUID to TypeID", () => {
      const uuid = "01893d8c-7e80-7000-8000-000000000000";
      const typeId = ensureTypeId(uuid, "post");
      expect(typeId).toMatch(/^post_/);
      expect(toUuid(typeId)).toBe(uuid);
    });

    it("passes through valid TypeIDs", () => {
      const original = generateId("post");
      const result = ensureTypeId(original, "post");
      expect(result).toBe(original);
    });

    it("throws for wrong prefix", () => {
      const boardId = generateId("board");
      expect(() => ensureTypeId(boardId, "post")).toThrow("Invalid post ID");
    });
  });

  describe("article prefix alias", () => {
    it("createId(kb_article) emits article_", () => {
      const id = createId("kb_article");
      expect(id).toMatch(/^article_/);
      expect(ID_PREFIXES.kb_article).toBe("article");
    });

    it("accepts retired kb_article_ ids as article ids", () => {
      const canonical = generateId("article");
      const legacy = `kb_article_${canonical.slice("article_".length)}`;
      expect(isValidTypeId(legacy, "article")).toBe(true);
      expect(isValidTypeId(canonical, "article")).toBe(true);
      expect(isTypeId(legacy, "article")).toBe(false);
      expect(isTypeId(canonical, "article")).toBe(true);
      expect(toUuid(legacy)).toBe(toUuid(canonical));
      expect(ensureTypeId(legacy, "article")).toBe(canonical);
      expect(normalizeToUuid(legacy, "article")).toBe(toUuid(canonical));
      expect(typeIdLookupKeys(legacy, "article")).toEqual([canonical, legacy]);
      expect(typeIdLookupKeys(canonical, "article")).toEqual([
        canonical,
        legacy,
      ]);
    });

    it("typeIdLookupKeys is only the canonical form when there is no alias", () => {
      const postId = generateId("post");
      expect(typeIdLookupKeys(postId, "post")).toEqual([postId]);
    });
  });
});

describe("validation contracts", () => {
  it.each(INVALID_TYPE_IDS)(
    "rejects malformed TypeIDs consistently: %s",
    (value) => {
      expect(isTypeIdFormat(value)).toBe(false);
      expect(isValidTypeId(value)).toBe(false);
      expect(isTypeId(value, "post")).toBe(false);
      expect(() => parseTypeId(value)).toThrow();
      expect(() => normalizeToUuid(value, "post")).toThrow();
      expect(() => ensureTypeId(value, "post")).toThrow();
    },
  );

  it.each(UUIDS)(
    "preserves UUID-shaped compatibility and round trips: %s",
    (uuid) => {
      expect(isUuid(uuid)).toBe(true);
      expect(normalizeToUuid(uuid, "post")).toBe(uuid);
      const id = fromUuid("post", uuid);
      expect(ensureTypeId(uuid, "post")).toBe(id);
      expect(toUuid(id)).toBe(uuid.toLowerCase());
      expect(fromUuid("post", toUuid(id))).toBe(id);
    },
  );

  it.each([
    "00000000000000000000000000",
    "custom_00000000000000000000000000",
    `${"a".repeat(63)}_00000000000000000000000000`,
    "a__b_00000000000000000000000000",
  ])("distinguishes generic TypeIDs from registered prefixes: %s", (value) => {
    expect(isTypeIdFormat(value)).toBe(true);
    expect(isValidTypeId(value)).toBe(true);
    expect(isValidTypeId(value, "post")).toBe(false);
    expect(isValidPrefix(getTypeIdPrefix(value))).toBe(false);
    expect(resolvePrefix(getTypeIdPrefix(value))).toBeUndefined();
  });

  it.each([
    "constructor",
    "toString",
    "__proto__",
    "hasOwnProperty",
    "unknown",
  ])("never resolves inherited or undeclared prefixes: %s", (prefix) => {
    expect(resolvePrefix(prefix)).toBeUndefined();
    expect(prefixMatches(prefix, "post")).toBe(false);
  });
});
