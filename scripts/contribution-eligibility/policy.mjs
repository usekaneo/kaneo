export const approvalLabel = "ready-for-contribution";
export const statusContext = "Contribution eligibility";

export function validatePolicy(policy) {
  if (!policy || typeof policy !== "object") {
    throw new Error("Missing contribution policy.");
  }
  const ids = new Set();
  for (const key of ["vouchedContributors", "exemptBots"]) {
    if (!Array.isArray(policy[key])) {
      throw new Error(`Contribution policy must define ${key}.`);
    }
    for (const account of policy[key]) {
      if (
        !Number.isSafeInteger(account.id) ||
        account.id <= 0 ||
        typeof account.login !== "string" ||
        !account.login.trim() ||
        typeof account.reason !== "string" ||
        !account.reason.trim() ||
        ids.has(account.id)
      ) {
        throw new Error(`Invalid or duplicate account in ${key}.`);
      }
      ids.add(account.id);
    }
  }
  return policy;
}

export function authorExemption(author, permission, policy) {
  if (!Number.isSafeInteger(author?.id) || author.id <= 0) {
    throw new Error("Missing pull request author identity.");
  }
  if (author.type === "Bot") {
    return policy.exemptBots.some((account) => account.id === author.id)
      ? "Approved automation."
      : null;
  }
  if (policy.vouchedContributors.some((account) => account.id === author.id)) {
    return "Vouched contributor; an issue is optional.";
  }
  if (
    permission?.permission === "admin" ||
    permission?.permission === "maintain" ||
    permission?.role_name === "maintain"
  ) {
    return "Repository maintainer; an issue is optional.";
  }
  return null;
}

export function assessIssues(issues) {
  const approved = issues.find(
    (issue) =>
      !issue.pull_request &&
      issue.state === "open" &&
      issue.labels.some((label) => label.name === approvalLabel),
  );
  return approved
    ? {
        state: "success",
        description: `Linked to approved issue #${approved.number}.`,
      }
    : {
        state: "failure",
        description: `Link an open issue labeled ${approvalLabel}, or ask a maintainer to vouch for you.`,
      };
}
