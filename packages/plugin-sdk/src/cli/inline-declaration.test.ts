import { describe, expect, it } from "vite-plus/test";
import { renderInlineDeclaration } from "./inline-declaration.js";

describe("renderInlineDeclaration", () => {
  it("writes an optional parameter when every option is optional", () => {
    const declaration = renderInlineDeclaration({
      input: "{ autoComplete?: boolean | undefined; }",
      output: "{ autoComplete: boolean; }",
      optional: true,
    });
    expect(declaration).toContain(
      "type Options = { autoComplete?: boolean | undefined; };",
    );
    expect(declaration).toContain(
      "declare const plugin: (options?: Options) => PluginDescriptor;",
    );
    expect(declaration).not.toMatch(/\bimport\b/);
  });

  it("requires options and maps plugins without options to undefined", () => {
    expect(
      renderInlineDeclaration({
        input: "{ token: string; }",
        output: "{ token: string; }",
        optional: false,
      }),
    ).toContain("(options: Options)");
    expect(
      renderInlineDeclaration({
        input: "never",
        output: "never",
        optional: true,
      }),
    ).toContain("type Options = undefined;");
  });
});
