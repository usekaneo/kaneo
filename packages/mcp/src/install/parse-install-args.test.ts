import { describe, expect, it } from "vitest";
import { parseInstallArgs } from "./index.js";

describe("parseInstallArgs", () => {
  it("parses flags", () => {
    // Arrange
    const argv = [
      "--target",
      "cursor-user",
      "--name",
      "my-kaneo",
      "-y",
      "--api-url",
      "http://example.com",
    ];
    const expected = {
      target: "cursor-user",
      output: undefined,
      name: "my-kaneo",
      yes: true,
      apiUrl: "http://example.com",
      projectDir: process.cwd(),
      help: false,
    };

    // Act
    const result = parseInstallArgs(argv);

    // Assert
    expect(result).toEqual(expected);
  });

  it("throws on unknown option", () => {
    // Arrange
    const argv = ["--nope"];
    // Act
    const act = () => parseInstallArgs(argv);

    // Assert
    expect(act).toThrow("Unknown option");
  });

  it("allows --target values that start with '-' when they are not flags", () => {
    // Arrange
    const argv = ["--target", "-my-server", "-y"];
    const expected = {
      target: "-my-server",
      output: undefined,
      name: "kaneo",
      yes: true,
      apiUrl: undefined,
      projectDir: process.cwd(),
      help: false,
    };

    // Act
    const result = parseInstallArgs(argv);

    // Assert
    expect(result).toEqual(expected);
  });
});
