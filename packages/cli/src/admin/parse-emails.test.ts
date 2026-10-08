import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parseEmails } from "./parse-emails.js";

describe("parseEmails", () => {
  it("lowercases, splits on commas and drops duplicates", () => {
    expect(
      parseEmails(["Grace@Example.com", "alan@example.com,grace@example.com"]),
    ).toEqual(Result.succeed(["grace@example.com", "alan@example.com"]));
  });

  it("names every invalid address", () => {
    const result = parseEmails(["grace", "alan@example.com", "x@y"]);
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "These are not email addresses: grace, x@y.",
    );
  });

  it("asks for at least one address", () => {
    const result = parseEmails([" , "]);
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "Who should be invited?",
    );
  });
});
