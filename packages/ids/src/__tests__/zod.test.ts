import { describe, it, expect } from "vite-plus/test";
import { z } from "zod";
import {
  typeIdSchema,
  flexibleIdSchema,
  flexibleToTypeIdSchema,
  anyTypeIdSchema,
  uuidSchema,
  postIdSchema,
  boardIdSchema,
  flexiblePostIdSchema,
  flexibleBoardIdSchema,
  tagIdsSchema,
} from "../zod";
import { generateId, toUuid } from "../core";
import { INVALID_TYPE_IDS, UUIDS } from "./fixtures";

describe("Zod TypeID Schemas", () => {
  describe("typeIdSchema", () => {
    it("accepts valid TypeIDs with correct prefix", () => {
      const schema = typeIdSchema("post");
      const postId = generateId("post");

      expect(schema.parse(postId)).toBe(postId);
    });

    it("rejects TypeIDs with wrong prefix", () => {
      const schema = typeIdSchema("post");
      const boardId = generateId("board");

      expect(() => schema.parse(boardId)).toThrow();
    });

    it("rejects raw UUIDs", () => {
      const schema = typeIdSchema("post");
      const uuid = "01893d8c-7e80-7000-8000-000000000000";

      expect(() => schema.parse(uuid)).toThrow();
    });

    it("rejects invalid strings", () => {
      const schema = typeIdSchema("post");

      expect(() => schema.parse("invalid")).toThrow();
      expect(() => schema.parse("")).toThrow();
      expect(() => schema.parse("post_invalid")).toThrow();
    });

    it("rewrites the retired kb_article_ alias to the canonical article_ prefix", () => {
      const schema = typeIdSchema("article");
      const canonical = generateId("article");
      const legacy = `kb_article_${canonical.slice("article_".length)}`;
      expect(schema.parse(canonical)).toBe(canonical);
      expect(schema.parse(legacy)).toBe(canonical);
    });
  });

  describe("flexibleIdSchema", () => {
    it("accepts TypeIDs and returns UUID", () => {
      const schema = flexibleIdSchema("post");
      const postId = generateId("post");

      const result = schema.parse(postId);
      expect(result).toBe(toUuid(postId));
    });

    it("accepts raw UUIDs and passes through", () => {
      const schema = flexibleIdSchema("post");
      const uuid = "01893d8c-7e80-7000-8000-000000000000";

      expect(schema.parse(uuid)).toBe(uuid);
    });

    it("rejects TypeIDs with wrong prefix", () => {
      const schema = flexibleIdSchema("post");
      const boardId = generateId("board");

      expect(() => schema.parse(boardId)).toThrow(
        "Expected post ID, got board ID",
      );
    });

    it("rejects invalid strings", () => {
      const schema = flexibleIdSchema("post");

      expect(() => schema.parse("invalid")).toThrow();
      expect(() => schema.parse("")).toThrow();
    });
  });

  describe("flexibleToTypeIdSchema", () => {
    it("converts UUID to TypeID", () => {
      const schema = flexibleToTypeIdSchema("post");
      const uuid = "01893d8c-7e80-7000-8000-000000000000";

      const result = schema.parse(uuid);
      expect(result).toMatch(/^post_/);
      expect(toUuid(result)).toBe(uuid);
    });

    it("passes through valid TypeIDs", () => {
      const schema = flexibleToTypeIdSchema("post");
      const postId = generateId("post");

      expect(schema.parse(postId)).toBe(postId);
    });

    it("rejects TypeIDs with wrong prefix", () => {
      const schema = flexibleToTypeIdSchema("post");
      const boardId = generateId("board");

      expect(() => schema.parse(boardId)).toThrow();
    });
  });

  describe("anyTypeIdSchema", () => {
    it("accepts any valid TypeID", () => {
      expect(anyTypeIdSchema.parse(generateId("post"))).toBeTruthy();
      expect(anyTypeIdSchema.parse(generateId("board"))).toBeTruthy();
      expect(anyTypeIdSchema.parse(generateId("post_comment"))).toBeTruthy();
    });

    it("rejects non-TypeID strings", () => {
      expect(() => anyTypeIdSchema.parse("invalid")).toThrow();
      expect(() =>
        anyTypeIdSchema.parse("01893d8c-7e80-7000-8000-000000000000"),
      ).toThrow();
    });
  });

  describe("uuidSchema", () => {
    it("accepts valid UUIDs", () => {
      const uuid = "01893d8c-7e80-7000-8000-000000000000";
      expect(uuidSchema.parse(uuid)).toBe(uuid);
    });

    it("rejects TypeIDs", () => {
      expect(() => uuidSchema.parse(generateId("post"))).toThrow();
    });

    it("rejects invalid strings", () => {
      expect(() => uuidSchema.parse("invalid")).toThrow();
    });
  });

  describe("pre-built schemas", () => {
    it("postIdSchema validates post IDs", () => {
      const postId = generateId("post");
      expect(postIdSchema.parse(postId)).toBe(postId);
      expect(() => postIdSchema.parse(generateId("board"))).toThrow();
    });

    it("boardIdSchema validates board IDs", () => {
      const boardId = generateId("board");
      expect(boardIdSchema.parse(boardId)).toBe(boardId);
      expect(() => boardIdSchema.parse(generateId("post"))).toThrow();
    });

    it("flexiblePostIdSchema accepts TypeID or UUID", () => {
      const postId = generateId("post");
      const uuid = toUuid(postId);

      expect(flexiblePostIdSchema.parse(postId)).toBe(uuid);
      expect(flexiblePostIdSchema.parse(uuid)).toBe(uuid);
    });

    it("flexibleBoardIdSchema accepts TypeID or UUID", () => {
      const boardId = generateId("board");
      const uuid = toUuid(boardId);

      expect(flexibleBoardIdSchema.parse(boardId)).toBe(uuid);
      expect(flexibleBoardIdSchema.parse(uuid)).toBe(uuid);
    });
  });

  describe("array schemas", () => {
    it("tagIdsSchema validates array of tag TypeIDs", () => {
      const tagIds = [
        generateId("post_tag"),
        generateId("post_tag"),
        generateId("post_tag"),
      ];

      const result = tagIdsSchema.parse(tagIds);
      // Strict TypeID schema returns TypeIDs unchanged
      expect(result).toEqual(tagIds);
    });

    it("tagIdsSchema rejects raw UUIDs", () => {
      const tagId1 = generateId("post_tag");
      const uuid2 = "01893d8c-7e80-7000-8000-000000000002";
      const tagId3 = generateId("post_tag");

      // Strict schema does not accept UUIDs
      expect(() => tagIdsSchema.parse([tagId1, uuid2, tagId3])).toThrow();
    });

    it("tagIdsSchema rejects wrong prefix", () => {
      const postId = generateId("post");
      expect(() => tagIdsSchema.parse([postId])).toThrow();
    });
  });

  describe("schema composition", () => {
    it("works in complex object schemas", () => {
      const createPostSchema = z.object({
        title: z.string().min(1),
        boardId: flexibleIdSchema("board"),
        tagIds: z.array(flexibleIdSchema("post_tag")),
      });

      const boardId = generateId("board");
      const tagId1 = generateId("post_tag");
      const tagId2 = "01893d8c-7e80-7000-8000-000000000002";

      const result = createPostSchema.parse({
        title: "Test Post",
        boardId,
        tagIds: [tagId1, tagId2],
      });

      expect(result.title).toBe("Test Post");
      expect(result.boardId).toBe(toUuid(boardId));
      expect(result.tagIds).toEqual([toUuid(tagId1), tagId2]);
    });

    it("provides helpful error messages", () => {
      const schema = z.object({
        postId: flexibleIdSchema("post"),
      });

      const result = schema.safeParse({ postId: generateId("board") });
      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected validation failure");
      expect(result.error).toBeInstanceOf(z.ZodError);
      expect(result.error.issues[0].message).toContain("Expected post ID");
      expect(result.error.issues[0].path).toEqual(["postId"]);
    });
  });
});

describe("shared schema contracts", () => {
  const strict = typeIdSchema("post");
  const toUuidSchema = flexibleIdSchema("post");
  const toTypeIdSchema = flexibleToTypeIdSchema("post");

  it.each([...INVALID_TYPE_IDS, null, undefined, 42, {}, []])(
    "reports invalid input through safeParse: %s",
    (value) => {
      for (const schema of [
        strict,
        toUuidSchema,
        toTypeIdSchema,
        anyTypeIdSchema,
        uuidSchema,
      ]) {
        const result = schema.safeParse(value);
        expect(result.success).toBe(false);
        if (result.success) throw new Error("Expected validation failure");
        expect(result.error).toBeInstanceOf(z.ZodError);
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    },
  );

  it.each(UUIDS)("preserves UUID-shaped values: %s", (uuid) => {
    expect(uuidSchema.parse(uuid)).toBe(uuid);
    expect(toUuidSchema.parse(uuid)).toBe(uuid);
    const canonical = toTypeIdSchema.parse(uuid);
    expect(toUuid(canonical)).toBe(uuid.toLowerCase());
    expect(strict.parse(canonical)).toBe(canonical);
    expect(anyTypeIdSchema.parse(canonical)).toBe(canonical);
    expect(toUuidSchema.parse(canonical)).toBe(uuid.toLowerCase());
    expect(strict.safeParse(uuid).success).toBe(false);
    expect(anyTypeIdSchema.safeParse(uuid).success).toBe(false);
  });

  it.each([
    "550e8400e29b41d4a716446655440000",
    "550e8400-e29b41d4-a716446655440000",
    " 550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440000\n",
  ])("rejects non-dashed or padded UUIDs: %s", (uuid) => {
    for (const schema of [uuidSchema, toUuidSchema, toTypeIdSchema]) {
      expect(schema.safeParse(uuid).success).toBe(false);
    }
  });

  it.each(["custom_00000000000000000000000000", "00000000000000000000000000"])(
    "validates generic TypeIDs without claiming a registered prefix: %s",
    (value) => {
      expect(anyTypeIdSchema.parse(value)).toBe(value);
      for (const schema of [strict, toUuidSchema, toTypeIdSchema]) {
        expect(schema.safeParse(value).success).toBe(false);
      }
    },
  );
});
