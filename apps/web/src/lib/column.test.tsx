import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getColumnIcon } from "./column";

describe("stored column icons", () => {
  it.each([
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
    "unknown-icon",
  ])("uses safe fallbacks for %s", (name) => {
    expect(getColumnIcon("to-do", false, name).type).toBe(Circle);
    expect(getColumnIcon("done", true, name).type).toBe(CheckCircle2);
    expect(getColumnIcon(name, false).type).toBe(Circle);
    expect(() =>
      renderToStaticMarkup(getColumnIcon("to-do", false, name)),
    ).not.toThrow();
  });
  it("keeps selected and default icons", () => {
    expect(getColumnIcon("to-do", false, "CircleDot").type).toBe(CircleDot);
    expect(getColumnIcon("in-progress").type).toBe(CircleDot);
    expect(getColumnIcon("done").type).toBe(CheckCircle2);
  });
});
