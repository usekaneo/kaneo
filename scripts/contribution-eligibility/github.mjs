export class GitHub {
  constructor(env, fetcher = fetch) {
    if (
      !/^[\w-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? "") ||
      [".", ".."].includes(env.GITHUB_REPOSITORY.split("/")[1])
    ) {
      throw new Error("Invalid GitHub repository.");
    }
    if (!env.GH_TOKEN) throw new Error("Missing GitHub token.");
    this.repository = env.GITHUB_REPOSITORY;
    this.apiURL = env.GITHUB_API_URL || "https://api.github.com";
    this.graphqlURL =
      env.GITHUB_GRAPHQL_URL || "https://api.github.com/graphql";
    this.token = env.GH_TOKEN;
    this.fetcher = fetcher;
  }

  async request(path, { method = "GET", body, allowNotFound = false } = {}) {
    const url = path === "graphql" ? this.graphqlURL : `${this.apiURL}/${path}`;
    const response = await this.fetcher(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`GitHub request failed (${response.status}).`);
    }
    const result = await response.json();
    if (result.errors?.length) {
      const details = result.errors
        .map((error) =>
          [error?.type, error?.message]
            .filter((value) => typeof value === "string")
            .join(": "),
        )
        .join("; ")
        .replaceAll(this.token, "[redacted]")
        .replace(/\p{Cc}/gu, " ")
        .slice(0, 1_000)
        .trim();
      throw new Error(
        `GitHub GraphQL request failed: ${details || "No error details returned."}`,
      );
    }
    return result;
  }

  async openPullRequests() {
    const pulls = [];
    for (let page = 1; ; page++) {
      const batch = await this.request(
        `repos/${this.repository}/pulls?state=open&per_page=100&page=${page}`,
      );
      pulls.push(...batch);
      if (batch.length < 100) return pulls;
    }
  }

  async convertToDraft(pullRequestId) {
    if (typeof pullRequestId !== "string" || !pullRequestId.trim()) {
      throw new Error("Missing pull request node ID.");
    }
    const result = await this.request("graphql", {
      method: "POST",
      body: {
        query: `mutation($pullRequestId: ID!) {
          convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
            pullRequest { id isDraft }
          }
        }`,
        variables: { pullRequestId },
      },
    });
    const converted = result.data?.convertPullRequestToDraft?.pullRequest;
    if (converted?.id !== pullRequestId || converted.isDraft !== true) {
      throw new Error("GitHub did not convert the pull request to draft.");
    }
  }

  async linkedIssues(number) {
    const [owner, name] = this.repository.split("/");
    const issues = new Map();
    let after = null;
    do {
      const result = await this.request("graphql", {
        method: "POST",
        body: {
          query: `query($owner: String!, $name: String!, $number: Int!, $after: String) {
            repository(owner: $owner, name: $name) {
              pullRequest(number: $number) {
                closingIssuesReferences(first: 100, after: $after) {
                  nodes {
                    number
                    state
                    repository { nameWithOwner }
                    labels(first: 100) {
                      nodes { name }
                      pageInfo { hasNextPage endCursor }
                    }
                  }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }`,
          variables: { owner, name, number, after },
        },
      });
      const connection =
        result.data?.repository?.pullRequest?.closingIssuesReferences;
      if (!connection) throw new Error("GitHub did not return linked issues.");
      for (const issue of connection.nodes) {
        if (
          issue &&
          issue.repository.nameWithOwner.toLowerCase() ===
            this.repository.toLowerCase()
        ) {
          issues.set(issue.number, {
            number: issue.number,
            state: issue.state.toLowerCase(),
            labels: await this.issueLabels(issue.number, issue.labels),
          });
        }
      }
      if (!connection.pageInfo.hasNextPage) return [...issues.values()];
      if (
        !connection.pageInfo.endCursor ||
        connection.pageInfo.endCursor === after
      ) {
        throw new Error("GitHub returned an invalid issue pagination cursor.");
      }
      after = connection.pageInfo.endCursor;
    } while (after);
  }

  async issueLabels(number, firstPage) {
    const [owner, name] = this.repository.split("/");
    let connection = firstPage;
    const labels = [...connection.nodes];
    let after = null;
    while (connection.pageInfo.hasNextPage) {
      if (
        !connection.pageInfo.endCursor ||
        connection.pageInfo.endCursor === after
      ) {
        throw new Error("GitHub returned an invalid label pagination cursor.");
      }
      after = connection.pageInfo.endCursor;
      const result = await this.request("graphql", {
        method: "POST",
        body: {
          query: `query($owner: String!, $name: String!, $number: Int!, $after: String) {
            repository(owner: $owner, name: $name) {
              issue(number: $number) {
                labels(first: 100, after: $after) {
                  nodes { name }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }`,
          variables: { owner, name, number, after },
        },
      });
      connection = result.data?.repository?.issue?.labels;
      if (!connection) throw new Error("GitHub did not return issue labels.");
      labels.push(...connection.nodes);
    }
    return labels;
  }
}
