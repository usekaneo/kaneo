import { describe, expect, it } from "vitest";
import { parseInstallArgs } from "./index.js";

describe("parseInstallArgs", () => {
  it("parses flags", () => {
    expect(
      parseInstallArgs([
        "--target",
        "cursor-user",
        "--name",
        "my-kaneo",
        "-y",
        "--api-url",
        "http://example.com",
      ]),
    ).toEqual({
      target: "cursor-user",
      output: undefined,
      name: "my-kaneo",
      yes: true,
      apiUrl: "http://example.com",
      projectDir: process.cwd(),
      help: false,
    });
  });

  it("throws on unknown option", () => {
    expect(() => parseInstallArgs(["--nope"])).toThrow("Unknown option");
  });
});
