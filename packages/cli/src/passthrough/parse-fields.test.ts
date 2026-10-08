import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parseFields, parseQuery } from "./parse-fields.js";

function body(fields: ReadonlyArray<string>) {
  const parsed = parseFields(fields);
  return Result.isSuccess(parsed) ? parsed.success : parsed.failure.message;
}

describe("parseFields", () => {
  it("parses JSON values and keeps everything else as strings", () => {
    expect(
      body([
        "title=Fix login",
        "count=3",
        "done=true",
        "due=null",
        'labels=["bug"]',
        'quoted="3"',
        "empty=",
        "url=https://a.test/?x=1",
      ]),
    ).toEqual({
      title: "Fix login",
      count: 3,
      done: true,
      due: null,
      labels: ["bug"],
      quoted: "3",
      empty: "",
      url: "https://a.test/?x=1",
    });
  });

  it("nests dotted keys", () => {
    expect(body(["a.b=1", "a.c.d=x", "e=2"])).toEqual({
      a: { b: 1, c: { d: "x" } },
      e: 2,
    });
  });

  it("rejects pairs without a key and conflicting nesting", () => {
    expect(body(["title"])).toBe("-f title is not a key=value pair.");
    expect(body(["=x"])).toBe("-f =x is not a key=value pair.");
    expect(body(["a=1", "a.b=2"])).toBe(
      "-f a.b=2 conflicts with an earlier value for a.",
    );
    expect(body(["a..b=1"])).toBe("-f a..b=1 has an empty key segment.");
  });

  it("keeps special keys as plain properties", () => {
    const parsed = body(["__proto__.polluted=1"]) as Record<string, unknown>;
    expect(JSON.stringify(parsed)).toBe('{"__proto__":{"polluted":1}}');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("parseQuery", () => {
  it("keeps values as strings", () => {
    const parsed = parseQuery(["limit=10", "q=a=b"]);
    expect(Result.isSuccess(parsed) && parsed.success).toEqual({
      limit: "10",
      q: "a=b",
    });
  });
});
