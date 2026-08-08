import { describe, expect, it } from "vitest";
import { TASK_SHORT_ID_PATTERN } from "../../../apps/api/src/search/task-short-id";

function parse(query: string) {
  const match = query.match(TASK_SHORT_ID_PATTERN);
  return match ? { slug: match[1], number: match[2] } : null;
}

describe("TASK_SHORT_ID_PATTERN", () => {
  it("matches an ASCII project key", () => {
    expect(parse("DEP-23")).toEqual({ slug: "DEP", number: "23" });
    expect(parse("S2-7")).toEqual({ slug: "S2", number: "7" });
  });

  it("matches keys generated from non-Latin project names", () => {
    expect(parse("ПА-23")).toEqual({ slug: "ПА", number: "23" });
    expect(parse("测试项-1")).toEqual({ slug: "测试项", number: "1" });
    expect(parse("ΑΒΓ-9")).toEqual({ slug: "ΑΒΓ", number: "9" });
  });

  it("still requires a leading letter and a trailing number", () => {
    expect(parse("23-45")).toBeNull();
    expect(parse("DEP-")).toBeNull();
    expect(parse("DEP")).toBeNull();
    expect(parse("-23")).toBeNull();
  });
});
