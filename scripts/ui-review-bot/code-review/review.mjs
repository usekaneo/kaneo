import { createHash } from "node:crypto";
import { excerpt } from "./context.mjs";
import { BASE_BEHAVIOR, INVESTIGATE, VERIFY } from "./prompts.mjs";

export const ENGINE_VERSION = 14;

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
  let removedContract = false;
  if (
    snapshot.read &&
    f.contract.path === f.path &&
    f.contract.revision === "base"
  ) {
    const head = await snapshot.read(f.path);
    removedContract = !head?.includes(f.contract.quote.trim());
  }
  if (candidate) {
    f.invalidCitations = invalid;
    if (removedContract)
      f.contractProblem =
        "The contract is only deleted implementation in the changed file. Replace it with an independent test, caller, schema or surviving invariant. Merely quoting the deleted check cannot establish required behavior.";
    return validEvidence > 0;
  }
  if (validEvidence === 0 || invalid.includes(f.contract) || removedContract)
    return false;
  f.evidence = f.evidence.filter((ref) => !invalid.includes(ref));
  return true;
}

async function reviewPacket(snapshot, model, { log = () => {} } = {}) {
  const startedAt = new Date().toISOString();
  const packet = await snapshot.collect();
  const report = {
    version: ENGINE_VERSION,
    startedAt,
    base: snapshot.base,
    head: snapshot.head,
    mode: "verified",
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
  let proposed = await model.ask(INVESTIGATE, packet, "investigate");
  const explored = [];
  if (Array.isArray(proposed.requests) && proposed.requests.length) {
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
    if ((await validFinding(f, snapshot, packet, true)) && !ids.has(f.id)) {
      candidates.push(f);
      ids.add(f.id);
    } else
      report.rejected.push({
        id: f?.id,
        reason: "Malformed finding or source citation could not be validated.",
        verdict: "uncertain",
      });
  }
  if (candidates.length) {
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
        delete updated.contractProblem;
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
          verdict: decision?.verdict === "reject" ? "reject" : "uncertain",
          validation:
            decision?.verdict === "keep"
              ? "invalid-citation-or-contract"
              : null,
        });
    }
  }
  if (report.findings.length && snapshot.read) {
    const existing = [];
    for (const finding of report.findings)
      if ((await snapshot.read(finding.path, snapshot.base)) !== null)
        existing.push(finding);
    const context = [];
    let size = 0;
    for (const f of existing) {
      for (const ref of [
        { path: f.path, line: f.line },
        ...f.evidence,
        f.contract,
      ]) {
        if (context.some((c) => c.path === ref.path)) continue;
        const source = await snapshot.read(ref.path, snapshot.base);
        if (source === null) continue;
        const item = {
          revision: "base",
          ...excerpt(ref.path, source, ref.line, 90),
        };
        if (size + item.text.length > 30_000) continue;
        context.push(item);
        size += item.text.length;
      }
    }
    const answers = existing.length
      ? await model.ask(
          BASE_BEHAVIOR,
          {
            context,
            questions: existing.map(({ id, trigger, actual }) => ({
              id,
              trigger,
              actual,
            })),
          },
          "base-behavior",
        )
      : { checks: [] };
    for (const finding of existing) {
      const checks = Array.isArray(answers.checks)
        ? answers.checks.filter((c) => String(c.id) === finding.id)
        : [];
      const check = checks.length === 1 ? checks[0] : null;
      let valid =
        check?.alreadyPresent === "no" &&
        short(check.reason, 2000) &&
        Array.isArray(check.evidence) &&
        check.evidence.length > 0 &&
        check.evidence.length <= 5;
      if (valid)
        for (const ref of check.evidence) {
          if (ref.revision !== "base" || !(await snapshot.citation(ref))) {
            valid = false;
            break;
          }
        }
      if (!valid) {
        report.findings = report.findings.filter((f) => f !== finding);
        report.rejected.push({
          id: finding.id,
          reason:
            check?.reason ||
            "New behavior could not be established against base",
          verdict:
            check?.alreadyPresent === "yes" ? "pre-existing" : "uncertain",
        });
      }
    }
  }
  report.status = report.rejected.some((r) => r.verdict === "uncertain")
    ? "partial"
    : "reviewed";
  report.finishedAt = new Date().toISOString();
  report.calls = model.calls;
  report.cost = model.calls.reduce((n, c) => n + (c.billedNow || 0), 0);
  report.costKnown = model.calls.every((c) => Number.isFinite(c.billedNow));
  report.coverage.limitations.push(
    "Model findings are source-reviewed hypotheses, not executed reproductions. No claim of bug-free code or superiority to other reviewers.",
  );
  return report;
}

export async function review(snapshot, model, options = {}) {
  if (!snapshot.packets) return reviewPacket(snapshot, model, options);
  const report = {
    version: ENGINE_VERSION,
    startedAt: new Date().toISOString(),
    base: snapshot.base,
    head: snapshot.head,
    mode: "verified",
    findings: [],
    rejected: [],
    coverage: {
      changed: [],
      omitted: [],
      limitations: [
        "Source-based review; no application code was executed. Zero findings is not an approval.",
      ],
    },
  };
  let failed = false;
  let partial = false;
  for await (const packet of snapshot.packets()) {
    report.coverage.omitted.push(...packet.omitted);
    if (!packet.changed.length) continue;
    try {
      const result = await reviewPacket(
        Object.assign(Object.create(snapshot), { collect: async () => packet }),
        model,
        options,
      );
      report.coverage.changed.push(...packet.changed.map((c) => c.path));
      report.rejected.push(...result.rejected);
      partial ||= result.status === "partial";
      for (const finding of result.findings)
        if (
          !report.findings.some(
            (f) => f.fingerprint && f.fingerprint === finding.fingerprint,
          )
        )
          report.findings.push(finding);
    } catch (error) {
      report.failure =
        error.code === "INVALID_MODEL_RESPONSE"
          ? "invalid-model-response"
          : error.code === "MODEL_HTTP_ERROR"
            ? `model-http-${error.status}`
            : error.name === "TimeoutError"
              ? "model-timeout"
              : "review-incomplete";
      failed = true;
      report.coverage.omitted.push(...packet.changed.map((c) => c.path));
      // A failed request may have incurred a charge; stop without retrying.
      break;
    }
  }
  report.status = failed
    ? "inconclusive"
    : partial || report.coverage.omitted.length
      ? "partial"
      : report.coverage.changed.length
        ? "reviewed"
        : "unsupported";
  if (snapshot.git) {
    const all = (
      await snapshot.git([
        "diff",
        "--name-only",
        "-z",
        snapshot.base,
        snapshot.head,
      ])
    )
      .split("\0")
      .filter(Boolean);
    report.coverage.omitted = all.filter(
      (file) => !report.coverage.changed.includes(file),
    );
    if (report.status === "reviewed" && report.coverage.omitted.length)
      report.status = "partial";
  }
  report.findings.sort(
    (a, b) => Number(b.severity === "high") - Number(a.severity === "high"),
  );
  report.findings = report.findings.slice(0, 5);
  if (failed) report.findings = [];
  report.finishedAt = new Date().toISOString();
  report.calls = model.calls;
  report.cost = model.calls.reduce((sum, c) => sum + (c.billedNow || 0), 0);
  report.costKnown = model.calls.every((c) => Number.isFinite(c.billedNow));
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
      `**Counterevidence checked:** ${safeText(f.disproofChecked || "Not available")}`,
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
