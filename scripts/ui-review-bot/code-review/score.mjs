import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function score(reviews, judgments) {
  const allowed = [
    "known-regression",
    "additional-valid",
    "false-positive",
    "duplicate",
    "uncertain",
  ];
  const seen = new Set();
  let detected = 0;
  const counts = Object.fromEntries(allowed.map((label) => [label, 0]));
  let unjudged = 0;
  let total = 0;
  for (const item of reviews) {
    let found = false;
    for (const finding of item.findings) {
      total++;
      const key = `${item.id}:${finding.fingerprint || finding.id}`;
      if (seen.has(key))
        throw new Error("Duplicate finding identity in score input.");
      seen.add(key);
      const judgment = judgments[key];
      if (!judgment) {
        unjudged++;
        continue;
      }
      if (
        !allowed.includes(judgment.label) ||
        typeof judgment.reason !== "string" ||
        !judgment.reason.trim()
      )
        throw new Error(`Invalid adjudication for ${key}`);
      if (judgment.label === "known-regression" && item.kind !== "regression")
        throw new Error("Control cannot match an injected regression.");
      counts[judgment.label]++;
      if (judgment.label === "known-regression") found = true;
    }
    if (found) detected++;
  }
  const regressions = reviews.filter((r) => r.kind === "regression").length;
  return {
    cases: reviews.length,
    regressions,
    detected,
    missed: regressions - detected,
    recall: regressions ? detected / regressions : null,
    publishedFindings: total,
    counts,
    unjudged,
    confirmedPrecision: total
      ? (counts["known-regression"] + counts["additional-valid"]) / total
      : null,
    controlsWithFindings: reviews.filter(
      (r) => r.kind === "control" && r.findings.length,
    ).length,
    inconclusive: reviews.filter(
      (r) => r.status === "inconclusive" || r.status === "unsupported",
    ).length,
    completeAdjudication: unjudged === 0 && counts.uncertain === 0,
    note: "Confirmed precision treats duplicates and unresolved findings as unconfirmed. Synthetic cases do not establish superiority on real PRs.",
  };
}

async function main() {
  const [reviewsFile, judgmentsFile, output] = process.argv.slice(2);
  if (!reviewsFile || !judgmentsFile)
    throw new Error(
      "Usage: score.mjs REVIEWS.json JUDGMENTS.json [OUTPUT.json]",
    );
  const result = score(
    JSON.parse(await readFile(reviewsFile, "utf8")),
    JSON.parse(await readFile(judgmentsFile, "utf8")),
  );
  if (output) await writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
