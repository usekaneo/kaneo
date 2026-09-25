import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { command, prNumber, REPO } from "./core.mjs";
import { findingDetails, runDetails } from "./findings.mjs";
import { uploadScreenshots } from "./upload.mjs";

export const ATTRIBUTION =
  "This UI-screenshot was auto-made by a beta tool made by @tinsever";
export const MARKER = "<!-- kaneo-ui-review:v1 -->";

// AI/source prose is displayed as text, never active Markdown or extra mentions.
export function plain(value, max = 1500) {
  return String(value ?? "")
    .slice(0, max)
    .replace(/\p{Cc}/gu, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}[\]()#!|~])/g, "\\$1")
    .replace(/@/g, "@\u200b")
    .replace(/https?:/gi, "$&\u200b");
}

function validateReport(run) {
  prNumber(run.prNumber);
  if (
    run.pr?.number !== run.prNumber ||
    !/^[a-f0-9]{40}$/.test(run.revisions?.after)
  )
    throw new Error("Report has no valid PR/revision identity.");
  if (!["complete", "partial"].includes(run.status) || !run.results?.length)
    throw new Error(
      "Only completed or partial screenshot reports can be posted.",
    );
}

export function commentBody(run, { images } = {}) {
  validateReport(run);
  if (!Array.isArray(images) || !images.length || images.length > 3)
    throw new Error("Upload the PR screenshots before publishing.");
  const lines = [
    ATTRIBUTION,
    "",
    "| Description | Screenshot |",
    "| --- | --- |",
  ];
  for (const image of images) {
    const url = String(image.url || "");
    if (
      !/^https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+$/.test(
        url,
      ) &&
      !new RegExp(
        `^https://raw\\.githubusercontent\\.com/${REPO}/[a-f0-9]{40}/screenshots/[a-zA-Z0-9_/-]+\\.png$`,
      ).test(url)
    )
      throw new Error("Use uploaded GitHub screenshot URLs.");
    lines.push(`| ${plain(image.description, 140)} | ![Screenshot](${url}) |`);
  }
  lines.push(
    "",
    ...findingDetails(run, plain),
    "",
    ...runDetails(run, plain),
    "",
    MARKER,
  );
  return lines.join("\n");
}

export async function githubAPI(endpoint, { method = "GET", body } = {}) {
  let folder;
  try {
    const args = ["api", endpoint, "--method", method];
    if (body) {
      folder = await mkdtemp(path.join(tmpdir(), "kaneo-ui-comment-"));
      const file = path.join(folder, "body.json");
      await writeFile(file, JSON.stringify(body), { mode: 0o600 });
      args.push("--input", file);
    }
    try {
      return JSON.parse(await command("gh", args));
    } catch (error) {
      const status = Number(
        String(error.stderr || "").match(/HTTP (\d{3})/)?.[1],
      );
      const failure = new Error(
        `GitHub API ${method} request failed${status ? ` (HTTP ${status})` : ""}.`,
      );
      failure.status = status || undefined;
      throw failure;
    }
  } finally {
    if (folder) await rm(folder, { recursive: true, force: true });
  }
}

export function publisherActor(env = process.env) {
  if (env.UI_REVIEW_BOT_LOGIN) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\[bot\]$/.test(env.UI_REVIEW_BOT_LOGIN))
      throw new Error(
        "UI_REVIEW_BOT_LOGIN must be the App slug followed by [bot].",
      );
    return env.UI_REVIEW_BOT_LOGIN;
  }
  if (env.GITHUB_ACTIONS === "true")
    throw new Error(
      "Set UI_REVIEW_BOT_LOGIN from the GitHub App token action's app-slug output.",
    );
  return undefined;
}

export async function publishReport(run, options = {}, api = githubAPI) {
  validateReport(run);
  const number = prNumber(run.prNumber);
  const login = options.actor || publisherActor() || (await api("user")).login;
  const endpoint = `repos/${REPO}/issues/${number}/comments`;
  let existing;
  for (let page = 1; ; page++) {
    const comments = await api(`${endpoint}?per_page=100&page=${page}`);
    existing =
      comments.find(
        (c) => c.user?.login === login && c.body?.includes(MARKER),
      ) || existing;
    if (comments.length < 100) break;
  }
  const current = await api(`repos/${REPO}/pulls/${number}`);
  if (current.state !== "open" || current.head.sha !== run.revisions.after)
    throw new Error(
      "PR changed or closed since capture. Run a fresh review before posting.",
    );
  const images =
    options.images || (await uploadScreenshots(run, options.folder, api));
  const body = commentBody(run, { images });
  const latest = await api(`repos/${REPO}/pulls/${number}`);
  if (latest.state !== "open" || latest.head.sha !== run.revisions.after)
    throw new Error(
      "PR changed or closed during upload. Run a fresh review before posting.",
    );
  const result = await api(
    existing ? `repos/${REPO}/issues/comments/${existing.id}` : endpoint,
    {
      method: existing ? "PATCH" : "POST",
      body: { body },
    },
  );
  return result.html_url;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = process.argv[2];
  if (!file)
    throw new Error("Usage: node publish.mjs /absolute/path/to/report.json");
  try {
    const run = JSON.parse(await readFile(file, "utf8"));
    const url = await publishReport(run, {
      folder: path.dirname(path.resolve(file)),
    });
    console.log(`GitHub comment: ${url}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
