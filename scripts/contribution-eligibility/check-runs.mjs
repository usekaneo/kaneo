import { statusContext } from "./policy.mjs";

export function checkPublisher(github) {
  const ids = new Map();
  return async (sha, result) => {
    const body = {
      name: statusContext,
      status: result.state === "pending" ? "in_progress" : "completed",
      ...(result.state === "pending"
        ? {}
        : { conclusion: result.state === "success" ? "success" : "failure" }),
      details_url: `https://github.com/${github.repository}/blob/main/CONTRIBUTING.md#contribution-eligibility`,
      output: {
        title: result.description,
        summary: `${result.description}\n\n[Contribution rules](https://github.com/${github.repository}/blob/main/CONTRIBUTING.md#contribution-eligibility).`,
      },
    };
    const id = ids.get(sha);
    const check = await github.request(
      `repos/${github.repository}/check-runs${id ? `/${id}` : ""}`,
      {
        method: id ? "PATCH" : "POST",
        body: id ? body : { ...body, head_sha: sha },
      },
    );
    if (!Number.isSafeInteger(check.id) || check.id <= 0) {
      throw new Error("GitHub did not return a check run ID.");
    }
    ids.set(sha, check.id);
  };
}
