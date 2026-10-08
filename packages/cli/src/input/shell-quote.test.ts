import { describe, expect, it } from "vite-plus/test";
import { shellQuote } from "./shell-quote.js";

describe("shellQuote", () => {
  it("leaves simple words alone", () => {
    expect(shellQuote("Bug")).toBe("Bug");
    expect(shellQuote("KAN-12")).toBe("KAN-12");
  });

  it("single quotes anything the shell would interpret", () => {
    expect(shellQuote('Needs "QA"')).toBe(`'Needs "QA"'`);
    expect(shellQuote("$(rm -rf ~)")).toBe(`'$(rm -rf ~)'`);
    expect(shellQuote("it's done")).toBe(`'it'\\''s done'`);
    expect(shellQuote("")).toBe("''");
  });
});
