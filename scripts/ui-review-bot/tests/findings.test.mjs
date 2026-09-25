import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAudit } from "../accessibility.mjs";
import { findingDetails, runDetails } from "../findings.mjs";
import { plain } from "../publish.mjs";

const violation = {
  id: "color-contrast",
  impact: "serious",
  help: "Insufficient text contrast",
  nodes: [{ name: "Design", summary: "Contrast is too low." }],
};
const audit = { status: "complete", violations: [violation], incomplete: [] };

test("accessibility findings are deduplicated and provide a concrete fix", () => {
  const text = findingDetails(
    {
      results: [1, 2].map((n) => ({
        name: `State ${n}`,
        after: { accessibility: audit },
      })),
    },
    plain,
  ).join("\n");
  assert.equal((text.match(/Accessibility · serious/g) || []).length, 1);
  assert.ok(text.includes("4.5:1"));
  assert.ok(text.includes("Findings (Beta)"));
  assert.ok(!text.includes("No automated"));
});

test("missing and inconclusive audits never masquerade as an accessibility pass", () => {
  const text = findingDetails(
    {
      results: [
        { after: { accessibility: { status: "failed" } } },
        {
          after: {
            accessibility: {
              status: "complete",
              violations: [],
              incomplete: [violation],
            },
          },
        },
      ],
    },
    plain,
  ).join("\n");
  assert.ok(text.includes("1/2"));
  assert.ok(text.includes("manual review"));
  assert.ok(!text.includes("No automated"));
});

test("untrusted findings cannot escape the collapsed section or create mentions", () => {
  const normalized = normalizeAudit({
    status: "complete",
    violations: [
      null,
      { id: "../../injected" },
      { ...violation, nodes: [{ name: "</details><script> @everyone" }] },
    ],
    incomplete: [],
  });
  assert.equal(normalized.violations.length, 1);
  const text = findingDetails(
    {
      results: [
        {
          after: { accessibility: normalized },
          review: {
            issues: [
              null,
              {
                severity: "warning",
                category: "visual",
                description: "</details><img src=x> @everyone",
                tip: "Use readable text.",
              },
            ],
          },
        },
      ],
    },
    plain,
  ).join("\n");
  assert.equal((text.match(/<\/details>/g) || []).length, 1);
  assert.ok(!text.includes("<img"));
  assert.ok(!text.includes("@everyone"));
  assert.ok(text.includes("AI suggestion"));
});

test("run info reports actual responding models, exact reported cost, and elapsed time", () => {
  const text = runDetails(
    {
      model: "requested-but-throttled",
      modelsUsed: ["google/gemini-2.5-flash-lite"],
      usage: { cost: 0.000934, costKnown: true },
      startedAt: "2026-09-17T10:00:00Z",
      finishedAt: "2026-09-17T10:02:04Z",
    },
    plain,
  ).join("\n");
  assert.ok(text.includes("google/gemini-2.5-flash-lite"));
  assert.ok(!text.includes("requested-but-throttled"));
  assert.ok(text.includes("$0.00093"));
  assert.ok(text.includes("2m 4s"));
  const unavailable = runDetails(
    { usage: { cost: 0, costKnown: false } },
    plain,
  ).join("\n");
  assert.equal((unavailable.match(/Unavailable/g) || []).length, 3);
  assert.ok(!unavailable.includes("$0"));
});
