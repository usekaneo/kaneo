import axe from "axe-core";

export function normalizeAudit(input) {
  if (
    input?.status !== "complete" ||
    !Array.isArray(input.violations) ||
    !Array.isArray(input.incomplete)
  )
    return {
      status: input?.status === "failed" ? "failed" : "not-run",
      violations: [],
      incomplete: [],
    };
  const rules = (items) =>
    items
      .slice(0, 20)
      .filter(
        (rule) =>
          typeof rule?.id === "string" && /^[a-z0-9-]{1,80}$/.test(rule.id),
      )
      .map((rule) => ({
        id: rule.id,
        impact: ["minor", "moderate", "serious", "critical"].includes(
          rule.impact,
        )
          ? rule.impact
          : "moderate",
        help: String(rule.help || rule.id).slice(0, 200),
        nodes: (Array.isArray(rule.nodes) ? rule.nodes : [])
          .slice(0, 3)
          .map((node) => ({
            name: String(node?.name || "Control").slice(0, 80),
            target: String(node?.target || "").slice(0, 250),
            summary: String(node?.summary || "").slice(0, 600),
          })),
      }));
  return {
    status: "complete",
    violations: rules(input.violations),
    incomplete: rules(input.incomplete),
  };
}

export async function auditAccessibility(page, frame) {
  try {
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(async (frame) => {
      const audit = await Promise.race([
        window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: [
              "wcag2a",
              "wcag2aa",
              "wcag21a",
              "wcag21aa",
              "wcag22aa",
              "best-practice",
            ],
          },
          resultTypes: ["violations", "incomplete"],
          elementRef: true,
          iframes: false,
          preload: false,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Audit timed out")), 15000),
        ),
      ]);
      const visible = (node) => {
        if (!node.element) return false;
        const r = node.element.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        const x = r.x + window.scrollX;
        const y = r.y + window.scrollY;
        if (!frame) return true;
        const overlap =
          Math.max(
            0,
            Math.min(x + r.width, frame.x + frame.width) - Math.max(x, frame.x),
          ) *
          Math.max(
            0,
            Math.min(y + r.height, frame.y + frame.height) -
              Math.max(y, frame.y),
          );
        return overlap >= (r.width * r.height) / 2;
      };
      const rules = (items) =>
        items
          .map((rule) => ({
            id: rule.id,
            impact: rule.impact,
            help: rule.help,
            nodes: rule.nodes
              .filter(visible)
              .slice(0, 3)
              .map((node) => ({
                name: (
                  node.element.getAttribute("aria-label") ||
                  node.element.getAttribute("placeholder") ||
                  node.element.innerText ||
                  node.element.tagName
                )
                  .trim()
                  .slice(0, 80),
                target: node.target.join(" ").slice(0, 250),
                summary: (node.failureSummary || "").slice(0, 600),
              })),
          }))
          .filter((rule) => rule.nodes.length)
          .slice(0, 20);
      return {
        status: "complete",
        violations: rules(audit.violations),
        incomplete: rules(audit.incomplete),
      };
    }, frame || null);
    return normalizeAudit(result);
  } catch {
    return { status: "failed", violations: [], incomplete: [] };
  }
}
