import { describe, expect, it } from "vite-plus/test";
import {
  findModuleSpecifiers,
  isRelativeSpecifier,
  isUrlSpecifier,
  packageNameOf,
} from "./module-specifiers.js";

describe("findModuleSpecifiers", () => {
  it("finds static, side-effect, dynamic, require and type references", () => {
    const code = `/// <reference types="node" />
import a from "zod";
import"./style.css";
export { b } from './b.js';
const c = await import("node:fs");
const d = require("@scope/pkg/sub");
type E = import("hono").Hono;`;
    expect(findModuleSpecifiers(code).sort()).toEqual(
      [
        "zod",
        "./style.css",
        "./b.js",
        "node:fs",
        "@scope/pkg/sub",
        "hono",
        "node",
      ].sort(),
    );
  });
});

describe("specifier helpers", () => {
  it("classifies specifiers and package names", () => {
    expect(isRelativeSpecifier("./chunks/a.js")).toBe(true);
    expect(isRelativeSpecifier("react")).toBe(false);
    expect(isUrlSpecifier("data:text/javascript,1")).toBe(true);
    expect(isUrlSpecifier("node:fs")).toBe(false);
    expect(packageNameOf("@tanstack/react-query/build")).toBe(
      "@tanstack/react-query",
    );
    expect(packageNameOf("react/jsx-runtime")).toBe("react");
  });
});
