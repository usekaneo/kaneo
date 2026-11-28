import { describe, expect, it } from "vite-plus/test";
import { readDeclaredType } from "./declared-type.js";

describe("readDeclaredType", () => {
  const source = `export declare const input: {
    mode: "a;b" | \`x\${string}\`;
    run?: ((value: number) => void) | undefined;
    list: Array<{ id: string; }>;
};
export declare const optional: true;
`;

  it("reads a multi-line object type up to its own semicolon", () => {
    expect(readDeclaredType(source, "input")).toBe(`{
    mode: "a;b" | \`x\${string}\`;
    run?: ((value: number) => void) | undefined;
    list: Array<{ id: string; }>;
}`);
  });

  it("reads single-line types and returns null for missing names", () => {
    expect(readDeclaredType(source, "optional")).toBe("true");
    expect(readDeclaredType(source, "output")).toBeNull();
  });
});
