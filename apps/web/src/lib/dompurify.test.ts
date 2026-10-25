import DOMPurify from "dompurify";
import { describe, expect, it } from "vite-plus/test";

describe("DOMPurify security regressions", () => {
  it("scrubs split template expressions inside attached shadow roots", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    // GHSA-cg2g-xh64-v4q7 joins these fragments when it removes the object.
    root.append(
      document.createTextNode("$"),
      document.createElement("object"),
      document.createTextNode("{alert(document.domain)}"),
    );

    DOMPurify.sanitize(host, { IN_PLACE: true, SAFE_FOR_TEMPLATES: true });
    root.normalize();

    expect(root.querySelector("object")).toBeNull();
    expect(root.textContent).not.toContain(`\${alert(document.domain)}`);
  });

  it("preserves diagram SVG while stripping executable content", () => {
    const svg = DOMPurify.sanitize(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">' +
        "<script>alert(1)</script>" +
        '<circle cx="10" cy="10" r="5" onclick="alert(1)" />' +
        '<a href="javascript:alert(1)"><text>Diagram</text></a>' +
        "</svg>",
      { USE_PROFILES: { svg: true, svgFilters: true } },
    );
    const container = document.createElement("div");
    container.innerHTML = svg;

    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("circle")?.getAttribute("r")).toBe("5");
    expect(container.querySelector("text")?.textContent).toBe("Diagram");
    expect(container.querySelector("script, [onload], [onclick]")).toBeNull();
    expect(container.querySelector("a")?.hasAttribute("href")).toBe(false);
  });
});
