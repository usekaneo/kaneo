import { describe, expect, it } from "vite-plus/test";
import { isTailwindClass } from "./tailwind-class.js";

describe("isTailwindClass", () => {
  it("recognizes common Tailwind utilities", () => {
    for (const name of [
      "hidden",
      "flex",
      "block",
      "grid",
      "inline",
      "contents",
      "sr-only",
      "absolute",
      "relative",
      "p-2",
      "-mt-1",
      "left-2.5",
      "w-1/2",
      "z-[1]",
      "text-sm",
      "text-center",
      "max-w-sm",
      "items-center",
      "font-medium",
      "bg-primary",
      "bg-primary/25",
      "text-muted-foreground",
      "border-sidebar-accent-foreground",
      "bg-red-500",
      "flex!",
      "!flex",
    ]) {
      expect(isTailwindClass(name), name).toBe(true);
    }
  });

  it("recognizes utilities behind Tailwind variants", () => {
    for (const name of [
      "sm:inline",
      "md:flex",
      "2xl:grid",
      "hover:bg-muted",
      "focus-visible:ring-2",
      "dark:bg-card",
      "group-hover:opacity-100",
      "data-[state=open]:flex",
      "max-md:hidden",
      "[&_svg]:size-4",
      "@md:flex",
    ]) {
      expect(isTailwindClass(name), name).toBe(true);
    }
  });

  it("accepts prefixed Tailwind classes and namespaced class names", () => {
    for (const name of [
      "gantt:flex",
      "gantt:hidden",
      "gantt:sm:inline",
      "gantt:[&_[data-slot=input]]:pl-8",
      "gantt:group",
      "tw-flex",
      "ktp-panel",
      "ktp-bar-fill",
      "task-progress-bar",
      "col-header",
      "row-title",
      "text-primary-heading",
      "dark",
      "group",
      "panel",
    ]) {
      expect(isTailwindClass(name), name).toBe(false);
    }
  });
});
