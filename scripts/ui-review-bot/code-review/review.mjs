import { createHash } from "node:crypto";
import { compareProbe, validProbe } from "./probe.mjs";
import { BASELINE, INVESTIGATE, VERIFY } from "./prompts.mjs";

export const ENGINE_VERSION = 6;

const short = (v, n) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= n;

export async function validFinding(f, snapshot, packet, candidate = false) {
  const changed = packet.changed.find((p) => p.path === f?.path);
  if (
    !changed ||
    !Number.isSafeInteger(f?.line) ||
    f.line < 1 ||
    !["high", "medium"].includes(f.severity) ||
    !["authorization", "data", "behavior", "ui"].includes(f.category) ||
    !["id", "title", "trigger", "expected", "actual", "introducedBy"].every(
      (k) => short(f[k], k === "id" ? 80 : 1200),
    ) ||
    !Array.isArray(f.evidence) ||
    f.evidence.length < 1 ||
    f.evidence.length > 20 ||
    !f.contract
  )
    return false;
  let validEvidence = 0;
  const invalid = [];
  for (const [index, ref] of [...f.evidence, f.contract].entries()) {
    if (snapshot.resolveCitation) {
      const resolved = await snapshot.resolveCitation(ref);
      if (!resolved) {
        invalid.push(ref);
        continue;
      }
      Object.assign(ref, resolved);
      if (index < f.evidence.length) validEvidence++;
    } else if (!(await snapshot.citation(ref))) invalid.push(ref);
    else if (index < f.evidence.length) validEvidence++;
  }
  if (!changed.lines.includes(f.line)) {
    const anchors = f.evidence
      .filter(
        (r) =>
          !invalid.includes(r) && r.path === f.path && r.revision !== "base",
      )
      .flatMap((r) =>
        changed.lines
          .filter((line) => Math.abs(line - r.line) <= 12)
          .map((line) => ({ line, distance: Math.abs(line - r.line) })),
      );
    if (!anchors.length) return false;
    f.line = anchors.sort((a, b) => a.distance - b.distance)[0].line;
  }
  if (candidate) {
    f.invalidCitations = invalid;
    return validEvidence > 0;
  }
  if (validEvidence === 0 || invalid.includes(f.contract)) return false;
  f.evidence = f.evidence.filter((ref) => !invalid.includes(ref));
  return true;
}

export async function review(
  snapshot,
  model,
  { baseline = false, probes = false, log = () => {} } = {},
) {
  const startedAt = new Date().toISOString();
  const packet = await snapshot.collect();
  const report = {
    version: ENGINE_VERSION,
    startedAt,
    base: snapshot.base,
    head: snapshot.head,
    mode: baseline ? "baseline" : "verified",
    findings: [],
    rejected: [],
    coverage: {
      changed: packet.changed.map((f) => f.path),
      omitted: packet.omitted,
      limitations: [packet.coverage],
    },
  };
  if (!packet.changed.length) {
    report.status = "unsupported";
    report.finishedAt = new Date().toISOString();
    return report;
  }
  log("Inspecting changed behavior and its local dependencies");
  let proposed = await model.ask(
    baseline ? BASELINE : INVESTIGATE,
    packet,
    "investigate",
  );
  const explored = [];
  if (
    !baseline &&
    Array.isArray(proposed.requests) &&
    proposed.requests.length
  ) {
    let bytes = 0;
    for (const request of proposed.requests.slice(0, 6)) {
      for (const item of await snapshot.lookup(request)) {
        if (bytes + item.text.length > 20_000) break;
        explored.push(item);
        bytes += item.text.length;
      }
    }
    if (explored.length) {
      log("Following requested symbols and contracts before deciding findings");
      proposed = await model.ask(
        INVESTIGATE,
        {
          ...packet,
          additional: explored,
          earlierCandidates: proposed.findings,
          instruction:
            "This is the final investigation pass. Reassess earlier candidates against new evidence, correct citations, and retain still-supported bugs. Return candidates or an empty list; no further discovery requests.",
        },
        "investigate-context",
      );
    }
  }
  if (!Array.isArray(proposed.findings) || proposed.findings.length > 5)
    throw new Error("Invalid candidate response; review is inconclusive.");
  const candidates = [];
  const ids = new Set();
  for (const f of proposed.findings) {
    if (Number.isSafeInteger(f?.id)) f.id = String(f.id);
    if (
      (await validFinding(f, snapshot, packet, !baseline)) &&
      !ids.has(f.id)
    ) {
      candidates.push(f);
      ids.add(f.id);
    } else
      report.rejected.push({
        id: f?.id,
        reason: "Malformed finding or source citation could not be validated.",
      });
  }
  if (baseline)
    report.findings = candidates.map((f) => ({
      ...f,
      evidenceLevel: "single-pass",
    }));
  else if (candidates.length) {
    const requests = [
      ...candidates.flatMap((f) =>
        Array.isArray(f.disproofQueries) ? f.disproofQueries : [],
      ),
      ...(Array.isArray(proposed.requests) ? proposed.requests : []),
    ].slice(0, 12);
    const additional = [...explored];
    let bytes = additional.reduce((n, item) => n + item.text.length, 0);
    for (const request of requests) {
      for (const item of await snapshot.lookup(request)) {
        if (bytes + item.text.length > 35_000) break;
        if (
          additional.some((r) => r.path === item.path && r.start === item.start)
        )
          continue;
        additional.push(item);
        bytes += item.text.length;
      }
    }
    log(
      `Checking ${candidates.length} candidate findings against callers, guards, and contracts`,
    );
    const verified = await model.ask(
      VERIFY,
      { ...packet, candidates, additional },
      "verify",
    );
    if (!Array.isArray(verified.decisions))
      throw new Error("Invalid verification response.");
    for (const candidate of candidates) {
      const matches = verified.decisions.filter((d) => d?.id === candidate.id);
      const decision = matches.length === 1 ? matches[0] : null;
      const updated = {
        ...candidate,
        ...Object.fromEntries(
          ["title", "severity", "trigger", "expected", "actual", "introducedBy"]
            .filter((key) => decision?.finding?.[key] !== undefined)
            .map((key) => [key, decision.finding[key]]),
        ),
        evidence: decision?.evidence,
        contract: decision?.contract,
      };
      if (
        decision?.verdict === "keep" &&
        short(decision.disproofChecked, 2000) &&
        short(decision.reason, 2000) &&
        (await validFinding(updated, snapshot, packet))
      ) {
        const fingerprint = createHash("sha256")
          .update(
            `${candidate.path}\0${updated.contract.path}\0${updated.contract.quote.trim()}`,
          )
          .digest("hex")
          .slice(0, 20);
        const headEvidence = updated.evidence.filter(
          (r) => r.path === updated.path && r.revision === "head",
        );
        const changed = packet.changed.find((p) => p.path === updated.path);
        const anchors = headEvidence.flatMap((r) =>
          changed.lines
            .filter((line) => Math.abs(line - r.line) <= 4)
            .map((line) => ({ line, distance: Math.abs(line - r.line) })),
        );
        if (anchors.length)
          updated.line = anchors.sort(
            (a, b) => a.distance - b.distance,
          )[0].line;
        delete updated.invalidCitations;
        if (!report.findings.some((f) => f.fingerprint === fingerprint))
          report.findings.push({
            ...updated,
            fingerprint,
            evidenceLevel: "code-path-reviewed",
            verification: decision.reason,
            disproofChecked: decision.disproofChecked,
          });
      } else
        report.rejected.push({
          id: candidate.id,
          reason:
            decision?.reason ||
            "Verification missing, ambiguous, or not supported by source.",
          verdict: decision?.verdict || "uncertain",
        });
    }
  }
  if (probes) {
    for (const finding of [...report.findings]) {
      if (!validProbe(finding.probe)) continue;
      log(`Running isolated before/after probe: ${finding.title}`);
      finding.reproduction = await compareProbe(snapshot, finding.probe);
      if (finding.reproduction.status === "reproduced")
        finding.evidenceLevel = "reproduced";
      else if (
        ["not-reproduced", "invalid-baseline", "unstable"].includes(
          finding.reproduction.status,
        )
      ) {
        report.findings = report.findings.filter((f) => f !== finding);
        report.rejected.push({
          id: finding.id,
          reason: `Proposed reproduction ${finding.reproduction.status}`,
          reproduction: finding.reproduction,
        });
      }
    }
  }
  report.status = "reviewed";
  report.finishedAt = new Date().toISOString();
  report.calls = model.calls;
  report.cost = model.calls.reduce((n, c) => n + (c.billedNow || 0), 0);
  report.costKnown = model.calls.every((c) => Number.isFinite(c.billedNow));
  report.coverage.limitations.push(
    "Model findings are source-reviewed hypotheses, not executed reproductions. No claim of bug-free code or superiority to other reviewers.",
  );
  return report;
}

export const safeText = (v) =>
  String(v ?? "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}[\]()#!|~])/g, "\\$1")
    .replace(/@/g, "@\u200b");

export function markdown(report) {
  const lines = [
    "# Peekareq code review (Beta)",
    "",
    `Revision: ${report.head}`,
    "",
    report.findings.length
      ? `${report.findings.length} findings with source evidence.`
      : "No publishable findings in the reviewed context. This is not an approval.",
    "",
  ];
  for (const f of report.findings) {
    lines.push(
      `## ${safeText(f.severity)}: ${safeText(f.title)}`,
      "",
      `${safeText(f.path)}:${f.line}`,
      "",
      `**Trigger:** ${safeText(f.trigger)}`,
      "",
      `**Expected:** ${safeText(f.expected)}`,
      "",
      `**Actual:** ${safeText(f.actual)}`,
      "",
      `**Evidence:** ${safeText(f.evidenceLevel)}`,
      "",
      `**Counterevidence checked:** ${safeText(f.disproofChecked || "Not checked in baseline")}`,
      "",
    );
    for (const ref of f.evidence)
      lines.push(
        `- ${safeText(ref.path)}:${ref.line} (${ref.revision || "head"}): ${safeText(ref.quote)}`,
      );
    lines.push("");
  }
  lines.push(
    "<details>",
    "<summary>Run info</summary>",
    "",
    `- Model: ${[...new Set((report.calls || []).map((c) => c.model))].map(safeText).join(", ") || "None"}`,
    `- Reported new AI cost: ${report.costKnown === false ? "Unavailable; maximum remains reserved" : `$${(report.cost || 0).toFixed(5)}`}`,
    `- Duration: ${Math.round((Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000)}s`,
    `- Omitted files: ${report.coverage.omitted.length}`,
    "",
    ...report.coverage.limitations.map((s) => `- ${safeText(s)}`),
    "",
    "</details>",
  );
  return lines.join("\n");
}
