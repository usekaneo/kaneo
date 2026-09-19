import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { prNumber, REPO } from "../identity.mjs";
import { githubAPI, plain, publisherActor } from "../publish.mjs";
import { authorizeRequest } from "../request-policy.mjs";
import { sourcePath } from "./context.mjs";

export const MARKER = "<!-- peekareview:v1 -->";
const sha = (value) => /^[a-f0-9]{40}$/.test(value || "");

export function commentBody(report) {
  prNumber(report.pr);
  if (
    !sha(report.head) ||
    !sha(report.base) ||
    !["reviewed", "partial", "inconclusive", "unsupported"].includes(
      report.status,
    ) ||
    !Array.isArray(report.findings) ||
    report.findings.length > 10
  )
    throw new Error("Invalid code-review report");
  const lines = [
    "This code review was auto-made by a beta tool made by @tinsever",
    "",
    "<details>",
    "<summary>Findings (Beta)</summary>",
    "",
  ];
  if (report.status !== "reviewed")
    lines.push("Review incomplete. This is not an approval.", "");
  for (const finding of report.findings) {
    if (
      !sourcePath(finding.path) ||
      !Number.isSafeInteger(finding.line) ||
      finding.line < 1 ||
      !["high", "medium"].includes(finding.severity)
    )
      throw new Error("Invalid finding identity");
    const url = `https://github.com/${REPO}/blob/${report.head}/${finding.path.split("/").map(encodeURIComponent).join("/")}#L${finding.line}`;
    lines.push(
      `- **${plain(finding.title, 240)}** — [${plain(finding.path)}:${finding.line}](${url})`,
      `  ${plain(finding.trigger, 600)} ${plain(finding.actual, 1000)}`,
      "",
    );
  }
  if (!report.findings.length)
    lines.push(
      report.status === "reviewed"
        ? "No actionable findings in the reviewed context. This is not an approval."
        : "No findings could be confirmed.",
      "",
    );
  const models = [...new Set((report.calls || []).map((c) => c.model))];
  const elapsed = Math.max(
    0,
    Math.round(
      (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000,
    ),
  );
  lines.push(
    "</details>",
    "",
    "<details>",
    "<summary>Run info</summary>",
    "",
    `- Model: ${models.map((m) => plain(m, 100)).join(", ") || "None"}`,
    `- AI cost: ${report.costKnown && Number.isFinite(report.cost) ? `$${report.cost.toFixed(5)}` : "Unavailable; maximum cost remains reserved"}`,
    `- Duration: ${Number.isFinite(elapsed) ? `${elapsed}s` : "Unavailable"}`,
    `- Revision: [${report.head.slice(0, 7)}](https://github.com/${REPO}/commit/${report.head})`,
    `- Omitted changed files: ${report.coverage?.omitted?.length || 0}`,
    "- Source-based review; application behavior was not executed.",
    "",
    "</details>",
    "",
    MARKER,
  );
  return lines.join("\n");
}

export async function publishReview(
  report,
  { actor, eventName, event },
  api = githubAPI,
) {
  if (actor !== "peekareq[bot]")
    throw new Error("Publish using the Peekareq App identity");
  const authorization = await authorizeRequest(
    eventName,
    event,
    (endpoint) => api(endpoint),
    "peekareview",
  );
  if (!authorization.allowed || authorization.pr !== report.pr)
    throw new Error("Review request is no longer authorized");
  const body = commentBody(report);
  const endpoint = `repos/${REPO}/issues/${report.pr}/comments`;
  let existing;
  for (let page = 1; ; page++) {
    const comments = await api(`${endpoint}?per_page=100&page=${page}`);
    existing =
      comments.find(
        (c) => c.user?.login === actor && c.body?.includes(MARKER),
      ) || existing;
    if (comments.length < 100) break;
  }
  const current = await api(`repos/${REPO}/pulls/${report.pr}`);
  if (
    current.state !== "open" ||
    current.head.sha !== report.head ||
    current.base.sha !== report.targetBase
  )
    throw new Error(
      "PR head or base changed during review; no stale comment posted",
    );
  return api(
    existing ? `repos/${REPO}/issues/comments/${existing.id}` : endpoint,
    { method: existing ? "PATCH" : "POST", body: { body } },
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const report = JSON.parse(await readFile(process.argv[2], "utf8"));
    const event = JSON.parse(
      await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    const result = await publishReview(report, {
      actor: publisherActor(),
      eventName: process.env.GITHUB_EVENT_NAME,
      event,
    });
    console.log(`Code review: ${result.html_url}`);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
