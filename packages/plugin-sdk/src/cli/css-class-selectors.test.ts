import { describe, expect, it } from "vite-plus/test";
import { findClassSelectors } from "./css-class-selectors.js";

function names(css: string) {
  return findClassSelectors(css).map((selector) => selector.name);
}

describe("findClassSelectors", () => {
  it("reads class names from selectors and unescapes them", () => {
    expect(
      findClassSelectors(
        String.raw`.hidden{display:none}@media (width>=48rem){.md\:flex{display:flex}}`,
      ),
    ).toEqual([
      { selector: ".hidden", name: "hidden" },
      { selector: String.raw`.md\:flex`, name: "md:flex" },
    ]);
  });

  it("reads every class in compound, nested and grouped selectors", () => {
    expect(
      names(
        String.raw`.a.b > .c, :where(.d) .e:hover{color:red;.f{color:blue}}.left-2\.5 [data-slot=input]{top:0}`,
      ),
    ).toEqual(["a", "b", "c", "d", "e", "f", "left-2.5"]);
  });

  it("decodes hex escapes", () => {
    expect(names(String.raw`.\32 xl\:flex{display:flex}`)).toEqual([
      "2xl:flex",
    ]);
  });

  it("ignores declarations, at-rule preludes, comments and strings", () => {
    expect(
      names(
        `/*! tailwindcss.com */@layer theme{:root{--spacing:.25rem;font-size:1.5rem}}@supports (color:color-mix(in lab, red, red)){}@property --tw-x{syntax:"*"}@keyframes spin{12.5%{opacity:.5}}[title=".hidden"]{content:'.flex'}`,
      ),
    ).toEqual([]);
  });
});
