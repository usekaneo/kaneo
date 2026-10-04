import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { GitHub } from "./github.mjs";
import { checkPublisher } from "./check-runs.mjs";
import { assessIssues, authorExemption, validatePolicy } from "./policy.mjs";

async function checkPullRequest(github, pull, policy, policyError) {
  if (policyError) throw policyError;
  let exemption = authorExemption(pull.user, null, policy);
  if (!exemption && pull.user.type !== "Bot") {
    const permission = await github.request(
      `repos/${github.repository}/collaborators/${encodeURIComponent(pull.user.login)}/permission`,
      { allowNotFound: true },
    );
    exemption = authorExemption(pull.user, permission, policy);
  }
  let result;
  if (exemption) {
    result = { state: "success", description: exemption };
  } else {
    result = assessIssues(await github.linkedIssues(pull.number));
  }
  const current = await github.request(
    `repos/${github.repository}/pulls/${pull.number}`,
  );
  if (current.state !== "open") return null;
  if (
    current.head.sha !== pull.head.sha ||
    current.body !== pull.body ||
    current.base.ref !== pull.base.ref
  ) {
    return {
      state: "pending",
      description: "Pull request changed; waiting for a fresh check.",
    };
  }
  return result;
}

export async function reconcile(github, loadPolicy) {
  let policy;
  let policyError;
  try {
    policy = validatePolicy(await loadPolicy());
  } catch (error) {
    policyError = error;
  }
  const pulls = await github.openPullRequests();
  const heads = new Map();
  const publish = checkPublisher(github);
  for (const pull of pulls) {
    if (!/^[a-f0-9]{40}$/.test(pull.head?.sha ?? "")) {
      throw new Error("Missing pull request head commit.");
    }
    if (!heads.has(pull.head.sha)) {
      // Clear earlier successes before reading mutable approval and trust data.
      await publish(pull.head.sha, {
        state: "pending",
        description: "Checking contribution eligibility.",
      });
      heads.set(pull.head.sha, []);
    }
  }
  const results = [];
  const errors = [];
  // Every event refreshes all open PRs: GitHub concurrency may replace a queued
  // run, so an event scoped to one PR could otherwise leave another check stale.
  for (const pull of pulls) {
    let result;
    try {
      result = await checkPullRequest(github, pull, policy, policyError);
    } catch (error) {
      errors.push(error);
      result = {
        state: "error",
        description:
          "Eligibility could not be checked. A maintainer must rerun the workflow.",
      };
    }
    if (result) {
      const entry = { number: pull.number, ...result };
      results.push(entry);
      heads.get(pull.head.sha).push(entry);
    }
  }
  // Checks belong to commits, not PRs. A vouched author's PR must never make
  // a different, ineligible PR sharing the same commit eligible to merge.
  const priority = ["error", "failure", "pending", "success"];
  for (const [sha, entries] of heads) {
    const worst = entries.toSorted(
      (a, b) => priority.indexOf(a.state) - priority.indexOf(b.state),
    )[0];
    if (worst) {
      await publish(sha, {
        state: worst.state,
        description: `PR #${worst.number}: ${worst.description}`,
      });
    }
  }
  if (policyError) errors.push(policyError);
  if (errors.length)
    throw new AggregateError(errors, "Contribution eligibility checks failed.");
  return results;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const github = new GitHub(process.env);
  const results = await reconcile(github, async () =>
    JSON.parse(
      await readFile(
        new URL("../../.github/contribution-policy.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  for (const result of results) {
    console.log(`PR #${result.number}: ${result.state}. ${result.description}`);
  }
}
