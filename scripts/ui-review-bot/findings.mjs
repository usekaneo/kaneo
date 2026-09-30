import { normalizeAudit } from "./accessibility.mjs";

const tips = {
  "color-contrast":
    "Use theme-aware foreground colors with at least 4.5:1 text contrast (3:1 for large text).",
  "button-name":
    "Give the button an accessible name that describes its action.",
  "link-name": "Give the link descriptive text or an accessible label.",
  label:
    "Associate the input with a visible label using for/id or aria-labelledby.",
  "select-name": "Associate the select with a visible label.",
  "aria-input-field-name":
    "Give the input an accessible name using a label or aria-labelledby.",
  "aria-required-parent":
    "Place the element inside the parent role required by its ARIA semantics (for example, a listitem inside a list).",
  region:
    "Group this content inside a main, navigation, or appropriately named region landmark.",
  "aria-hidden-focus": "Keep hidden content out of the keyboard tab order.",
  "image-alt":
    "Add meaningful alternative text, or empty alt text for a decorative image.",
  "target-size":
    "Increase the control's clickable area or its spacing from nearby controls.",
};

export function findingDetails(run, plain) {
  const grouped = new Map();
  let complete = 0;
  let incomplete = 0;
  for (const item of run.results) {
    const audit = normalizeAudit(item.after?.accessibility);
    if (audit.status === "complete") complete++;
    incomplete += audit.incomplete.length;
    for (const rule of audit.violations) {
      const existing = grouped.get(rule.id);
      if (existing) {
        existing.scenarios.add(item.name);
        for (const node of rule.nodes)
          if (
            !existing.nodes.some((n) => n.name === node.name) &&
            existing.nodes.length < 3
          )
            existing.nodes.push(node);
      } else grouped.set(rule.id, { ...rule, scenarios: new Set([item.name]) });
    }
  }
  const lines = ["<details>", "<summary>Findings (Beta)</summary>", ""];
  const severity = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const rules = [...grouped.values()].sort(
    (a, b) => severity[a.impact] - severity[b.impact],
  );
  for (const rule of rules.slice(0, 6)) {
    const examples = rule.nodes
      .map((node) => node.name)
      .filter(Boolean)
      .join(", ");
    const tip =
      tips[rule.id] ||
      rule.nodes[0]?.summary ||
      "Review the affected control's semantics and accessible name.";
    lines.push(
      `- **Accessibility · ${rule.impact}:** ${plain(rule.help, 200)}${examples ? ` — ${plain(examples, 120)}` : ""}. ${plain(tip, 350)} ([rule guidance](https://dequeuniversity.com/rules/axe/4.13/${rule.id})).`,
    );
  }
  if (rules.length > 6)
    lines.push(
      `- ${rules.length - 6} additional accessibility rule findings are recorded in the run report.`,
    );
  if (!rules.length && complete === run.results.length)
    lines.push(
      "- No automated accessibility violations found in the captured areas.",
    );
  if (complete !== run.results.length)
    lines.push(
      `- Accessibility checks completed for ${complete}/${run.results.length} captured states; remaining checks are unavailable.`,
    );
  if (incomplete)
    lines.push(
      `- ${incomplete} accessibility checks need manual review; they are not confirmed failures.`,
    );
  const seen = new Set();
  for (const item of run.results) {
    const issues = Array.isArray(item.review?.issues) ? item.review.issues : [];
    for (const issue of issues.slice(0, 5)) {
      if (
        !["warning", "error"].includes(issue?.severity) ||
        !["visual", "usability"].includes(issue.category) ||
        typeof issue.description !== "string" ||
        !issue.description.trim()
      )
        continue;
      const key = issue.description.trim().toLowerCase();
      if (seen.has(key) || seen.size >= 3) continue;
      seen.add(key);
      lines.push(
        `- **AI suggestion:** ${plain(issue.description, 240)}${issue.tip ? ` Tip: ${plain(issue.tip, 240)}` : ""}`,
      );
    }
  }
  lines.push(
    "",
    "Checks cover the captured states, not full accessibility compliance. Keyboard and screen-reader testing still need manual review.",
    "",
    "</details>",
  );
  return lines;
}

export function runDetails(run, plain) {
  const models = Array.isArray(run.modelsUsed)
    ? [...new Set(run.modelsUsed)].slice(0, 5)
    : [];
  const cost =
    Number.isFinite(run.usage?.cost) &&
    run.usage.cost >= 0 &&
    run.usage.costKnown === true
      ? `$${run.usage.cost.toFixed(5)}`
      : "Unavailable";
  const elapsed = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  const seconds = Math.round(elapsed / 1000);
  const duration =
    Number.isFinite(seconds) && seconds >= 0
      ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
      : "Unavailable";
  return [
    "<details>",
    "<summary>Run info</summary>",
    "",
    `- **AI model:** ${models.length ? models.map((model) => plain(model, 120)).join(", ") : "Unavailable"}`,
    `- **AI cost (reported):** ${cost}`,
    `- **Duration:** ${duration}`,
    "",
    "</details>",
  ];
}
