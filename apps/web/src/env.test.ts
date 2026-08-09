import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const placeholderPattern = "[`\\\"']KANEO_[A-Z_]+[`\\\"']";

describe("runtime environment replacement", () => {
  it("strips unset placeholders regardless of the quote emitted by the bundler", () => {
    const bundle = [
      'const doubleQuoted = "KANEO_DOUBLE_QUOTED";',
      "const singleQuoted = 'KANEO_SINGLE_QUOTED';",
      "const templateLiteral = `KANEO_TEMPLATE_LITERAL`;",
      'const configured = "https://example.com";',
    ].join("\n");

    const result = execFileSync("sed", ["-E", `s#${placeholderPattern}#""#g`], {
      input: bundle,
      encoding: "utf8",
    });

    expect(result).not.toMatch(/KANEO_[A-Z_]+/);
    expect(result).toContain('const doubleQuoted = "";');
    expect(result).toContain('const singleQuoted = "";');
    expect(result).toContain('const templateLiteral = "";');
    expect(result).toContain('const configured = "https://example.com";');
  });

  it("uses the quote-agnostic pattern in the container entrypoint", () => {
    const entrypoint = readFileSync(
      path.resolve(import.meta.dirname, "../env.sh"),
      "utf8",
    );

    expect(entrypoint).toContain(
      `sed -i -E 's#[\`"'"'"']KANEO_[A-Z_]+[\`"'"'"']#""#g'`,
    );
  });
});
