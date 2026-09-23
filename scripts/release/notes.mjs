#!/usr/bin/env node
// semantic-release generateNotes plugin.
//
// Kaneo merges most pull requests with merge commits, so a release range contains
// every branch-internal commit rather than one commit per PR. Each commit is mapped
// back to its pull request through the commit-association endpoint, which resolves
// merge-commit branches as well as squashes, and the range is then collapsed to one
// entry per pull request.
//
// Preview a range locally:  node scripts/release/notes.mjs v2.20.0 v2.21.0
import { execFileSync } from "node:child_process";

const SECTIONS = [
  ["feat", "Features"],
  ["fix", "Bug Fixes"],
  ["perf", "Performance Improvements"],
  ["revert", "Reverts"],
  ["refactor", "Code Refactoring"],
  ["docs", "Documentation"],
];

const RANK = new Map(SECTIONS.map(([type], index) => [type, index]));
const SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;
const BREAKING = /^BREAKING[ -]CHANGE:/m;

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function parse(commit) {
  const match = SUBJECT.exec(commit.subject);
  if (!match) return null;
  const [, type, scope, bang, description] = match;
  return {
    ...commit,
    type: type.toLowerCase(),
    scope: scope || null,
    description,
    breaking: Boolean(bang) || BREAKING.test(commit.body),
  };
}

function readCommits(from, to) {
  const range = from ? `${from}..${to}` : to;
  const raw = git("log", "--no-merges", "--format=%H%x00%s%x00%b%x1e", range);
  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body = ""] = entry.split("\x00");
      return { hash, subject, body };
    });
}

async function resolvePullRequests(commits, { repo, token, logger }) {
  const found = new Map();
  if (!token) {
    logger.log("notes: no GitHub token, falling back to commit links");
    return found;
  }

  const queue = [...commits];
  const workers = Array.from({ length: 8 }, async () => {
    for (let commit = queue.shift(); commit; commit = queue.shift()) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repo}/commits/${commit.hash}/pulls`,
          {
            headers: {
              accept: "application/vnd.github+json",
              authorization: `Bearer ${token}`,
              "user-agent": "kaneo-release-notes",
            },
          },
        );
        if (!response.ok) continue;
        // Oldest association wins; a commit cherry-picked later still credits the PR that introduced it.
        const [pull] = await response.json();
        if (pull) found.set(commit.hash, pull);
      } catch (error) {
        // Never fail the release over note decoration; the commit link is a fine fallback.
        logger.log(
          `notes: ${commit.hash.slice(0, 7)} lookup failed (${error.message})`,
        );
      }
    }
  });

  await Promise.all(workers);
  return found;
}

function collapse(commits, pulls) {
  const entries = new Map();

  for (const commit of commits) {
    const pull = pulls.get(commit.hash);
    const key = pull ? `pr:${pull.number}` : `commit:${commit.hash}`;
    const existing = entries.get(key);

    if (!existing) {
      entries.set(key, { commit, pull });
      continue;
    }
    // One line per pull request: the most significant change in it speaks for the whole.
    const rank = (candidate) =>
      RANK.get(candidate.type) ?? Number.MAX_SAFE_INTEGER;
    if (
      (existing.commit.breaking ? 0 : 1) > (commit.breaking ? 0 : 1) ||
      rank(commit) < rank(existing.commit)
    ) {
      entries.set(key, { commit, pull });
    }
  }

  return [...entries.values()];
}

function isBot(login) {
  return !login || login.endsWith("[bot]") || login === "Copilot";
}

function render(entries, { repo }) {
  const commitUrl = (hash) => `https://github.com/${repo}/commit/${hash}`;
  const grouped = new Map(SECTIONS.map(([, heading]) => [heading, []]));
  const breaking = [];
  const credits = new Set();

  for (const { commit, pull } of entries) {
    if (pull && !isBot(pull.user?.login)) credits.add(pull.user.login);

    const heading = grouped.has(sectionFor(commit)) ? sectionFor(commit) : null;
    if (!heading && !commit.breaking) continue;

    // The pull request title is the better summary when it agrees with the commit
    // about what kind of change this is; when it disagrees it is usually describing
    // the whole branch rather than the part that landed in this range.
    const titled = pull
      ? parse({ subject: pull.title, body: "", hash: "" })
      : null;
    const headline = titled && titled.type === commit.type ? titled : commit;

    const scope = headline.scope ? `**${headline.scope}:** ` : "";
    const reference = pull
      ? `#${pull.number}`
      : `[${commit.hash.slice(0, 7)}](${commitUrl(commit.hash)})`;
    const line = `- ${scope}${headline.description}: ${reference}`;

    if (commit.breaking) breaking.push(line);
    else grouped.get(heading).push(line);
  }

  let notes = "";
  if (breaking.length)
    notes += `### BREAKING CHANGES\n\n${breaking.join("\n")}\n\n`;
  for (const [, heading] of SECTIONS) {
    const lines = grouped.get(heading);
    if (lines.length) notes += `### ${heading}\n\n${lines.join("\n")}\n\n`;
  }
  if (credits.size) {
    notes += `### Credits\n\nHuge thanks to ${formatList([...credits].map((login) => `@${login}`))} for helping!\n`;
  }
  return notes.trimEnd();
}

function sectionFor(commit) {
  const index = RANK.get(commit.type);
  return index === undefined ? null : SECTIONS[index][1];
}

function formatList(names) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

async function build({ from, to, repo, token, logger }) {
  const commits = readCommits(from, to).map(parse).filter(Boolean);
  const pulls = await resolvePullRequests(commits, { repo, token, logger });
  return render(collapse(commits, pulls), { repo });
}

export async function generateNotes(_pluginConfig, context) {
  const { lastRelease, nextRelease, env, logger } = context;
  return build({
    from: lastRelease?.gitTag || lastRelease?.gitHead,
    to: nextRelease.gitHead || "HEAD",
    repo: env.GITHUB_REPOSITORY || "usekaneo/kaneo",
    token: env.GITHUB_TOKEN || env.GH_TOKEN,
    logger,
  });
}

const invokedDirectly =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (invokedDirectly) {
  const [from, to = "HEAD"] = process.argv.slice(2);
  const token =
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    (() => {
      try {
        return execFileSync("gh", ["auth", "token"], {
          encoding: "utf8",
        }).trim();
      } catch {
        return "";
      }
    })();
  console.log(
    await build({
      from,
      to,
      repo: "usekaneo/kaneo",
      token,
      logger: { log: () => {} },
    }),
  );
}
