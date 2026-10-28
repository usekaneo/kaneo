import type { Octokit } from "octokit";

export async function taskLinkCommentExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
) {
  // A failed create response can leave a delivered comment without its local
  // completion marker. Read outside the write guard; any retry gets a fresh one.
  for (let page = 1; ; page++) {
    const { data } = await octokit.rest.issues
      .listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
        page,
        request: { timeout: 10_000 },
      })
      .catch(() => {
        throw new Error("Task-link comment could not be verified");
      });
    if (data.some((comment) => comment.body === body)) return true;
    if (data.length < 100) return false;
  }
}
