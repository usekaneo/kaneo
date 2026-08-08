import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "../../../apps/api/src/search/like-pattern";

describe("escapeLikePattern", () => {
  it("escapes the single-character wildcard", () => {
    // Checked against Postgres 16: `slug ILIKE 'A_B'` returns both `A_B` and
    // `ACB`, while `slug ILIKE 'A\_B'` returns only `A_B`.
    expect(escapeLikePattern("A_B")).toBe("A\\_B");
    expect(escapeLikePattern("DE_")).toBe("DE\\_");
  });

  it("escapes the multi-character wildcard and the escape character itself", () => {
    expect(escapeLikePattern("50%")).toBe("50\\%");
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("leaves a key with no wildcard exactly as it is", () => {
    expect(escapeLikePattern("DEP")).toBe("DEP");
    expect(escapeLikePattern("ПА")).toBe("ПА");
    expect(escapeLikePattern("测试项")).toBe("测试项");
  });
});
