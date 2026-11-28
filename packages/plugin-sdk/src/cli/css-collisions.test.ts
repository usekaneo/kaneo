import { describe, expect, it } from "vite-plus/test";
import {
  describeHostCollisions,
  findHostCollisions,
  tailwindPrefixFor,
} from "./css-collisions.js";

describe("findHostCollisions", () => {
  it("lists each unprefixed Tailwind class selector once, in order", () => {
    const css = String.raw`@layer utilities{.hidden{display:none}.flex{display:flex}.ktp-panel{gap:1rem}.hidden.sr-only{top:0}@media (width>=48rem){.md\:flex{display:flex}}}`;
    expect(findHostCollisions(css)).toEqual([
      ".hidden",
      ".flex",
      ".sr-only",
      String.raw`.md\:flex`,
    ]);
  });

  it("accepts prefixed Tailwind output and namespaced plain CSS", () => {
    const tailwind = String.raw`/*! tailwindcss v4 | https://tailwindcss.com */@layer theme{:root,:host{--gantt-spacing:.25rem}}@layer utilities{.gantt\:hidden{display:none}@media (width>=40rem){.gantt\:sm\:inline{display:inline}}.gantt\:group-hover\:bg-primary:is(:where(.gantt\:group):hover *){background-color:var(--primary)}}@property --tw-shadow{syntax:"*";inherits:false}`;
    const plain =
      ".ktp-panel{display:flex}.ktp-list > li + li{border-top:1px solid var(--border)}.dark .ktp-row:hover{background:var(--accent)}";
    expect(findHostCollisions(tailwind)).toEqual([]);
    expect(findHostCollisions(plain)).toEqual([]);
  });

  it("flags arbitrary value utilities and accepts variant namespaced classes", () => {
    const css = String.raw`.bg-\[\#fafafa\]{background-color:#fafafa}.gantt\:bg-\[\#fafafa\]{background-color:#fafafa}.hover\:plugin-panel:hover{color:red}.hover\:bg-\[\#fafafa\]:hover{background-color:#fafafa}`;
    expect(findHostCollisions(css)).toEqual([
      String.raw`.bg-\[\#fafafa\]`,
      String.raw`.hover\:bg-\[\#fafafa\]`,
    ]);
  });
});

describe("tailwindPrefixFor", () => {
  it("keeps only the letters of the plugin ID", () => {
    expect(tailwindPrefixFor("gantt")).toBe("gantt");
    expect(tailwindPrefixFor("task-progress-2")).toBe("taskprogress");
    expect(tailwindPrefixFor("42")).toBe("plugin");
  });
});

describe("describeHostCollisions", () => {
  it("names up to five selectors and shows the prefix to use", () => {
    const selectors = [
      ".hidden",
      ".flex",
      String.raw`.md\:flex`,
      ".p-2",
      ".text-sm",
      ".block",
      ".grid",
    ];
    expect(
      describeHostCollisions("dist/web/index.css", selectors, "task-progress"),
    ).toBe(
      String.raw`dist/web/index.css defines class selectors that collide with Kaneo's own Tailwind classes: .hidden, .flex, .md\:flex, .p-2, .text-sm and 2 more. Plugin CSS loads into Kaneo's page, so these rules override Kaneo's layout. Set a Tailwind prefix with @import "tailwindcss/theme.css" layer(theme) prefix(taskprogress); and write classes as taskprogress:flex, or use namespaced class names such as .taskprogress-panel.`,
    );
  });

  it("does not add a count when every selector is shown", () => {
    expect(
      describeHostCollisions("dist/web/index.css", [".hidden"], "gantt"),
    ).toContain("Tailwind classes: .hidden. Plugin CSS");
  });
});
