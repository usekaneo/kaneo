import { z } from "zod";
import type { GitHubConfig } from "../plugins/github/config";
import type { getVerifiedInstallationOctokit } from "../plugins/github/utils/github-app";
import type { GitHubImportState } from "./import-state";

export const IMPORT_PAGES_PER_REQUEST = 4;
export const IMPORT_LABELS_PER_PAGE = 25;
export const IMPORT_COMMENTS_PER_PAGE = 20;
export const IMPORT_PULLS_PER_PAGE = 10;
const pageInfo = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().max(2048).nullable(),
});
const actor = z
  .object({
    login: z.string().max(255),
    avatarUrl: z.string().max(4096),
    __typename: z.string(),
  })
  .nullable();
const label = z.object({
  name: z.string().max(1024),
  color: z.string().max(64),
});
const comment = z.object({
  body: z.string().max(1_000_000),
  url: z.string().max(4096),
  author: actor,
  createdAt: z.iso.datetime(),
});
function connection<T extends z.ZodType>(node: T, limit: number) {
  return z
    .object({
      totalCount: z.number().int().nonnegative(),
      pageInfo,
      nodes: z.array(node).max(limit),
    })
    .refine(
      (page) => !page.pageInfo.hasNextPage || page.nodes.length > 0,
      "An unfinished page must contain nodes",
    );
}
const labels = connection(label, IMPORT_LABELS_PER_PAGE);
const comments = connection(comment, IMPORT_COMMENTS_PER_PAGE);
const issue = z.object({
  number: z.number().int().positive(),
  title: z.string().max(4096),
  body: z.string().max(1_000_000).nullable(),
  url: z.string().max(4096),
  state: z.enum(["OPEN", "CLOSED"]),
  createdAt: z.iso.datetime(),
  author: actor,
  labels,
  comments,
});
const pull = z.object({
  number: z.number().int().positive(),
  title: z.string().max(4096),
  body: z.string().max(1_000_000).nullable(),
  url: z.string().max(4096),
  state: z.string(),
  createdAt: z.iso.datetime(),
  headRefName: z.string().max(4096),
  author: actor,
});
const repository = z.object({ databaseId: z.number().int().positive() });
export const issuesPageSchema = z.object({
  repository: repository.extend({ issues: connection(issue, 1) }),
});
export const labelsPageSchema = z.object({
  repository: repository.extend({ issue: z.object({ labels }).nullable() }),
});
export const commentsPageSchema = z.object({
  repository: repository.extend({ issue: z.object({ comments }).nullable() }),
});
export const pullsPageSchema = z.object({
  repository: repository.extend({
    pullRequests: connection(pull, IMPORT_PULLS_PER_PAGE),
  }),
});
export type ImportedIssue = z.infer<typeof issue>;
export type ImportedPull = z.infer<typeof pull>;
export type ImportedLabel = z.infer<typeof label>;
export type ImportedComment = z.infer<typeof comment>;

const actorFields = "author { __typename login avatarUrl }";
const pageFields = "totalCount pageInfo { hasNextPage endCursor }";
// Explicit first/after connections, never paginate() or an aggregate catalog.
export const importQueries = {
  issues: `query ImportIssues($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) { databaseId
      issues(first: 1, after: $cursor, states: OPEN, orderBy: {field: CREATED_AT, direction: ASC}) {
        ${pageFields} nodes { number title body url state createdAt ${actorFields}
          labels(first: ${IMPORT_LABELS_PER_PAGE}) { ${pageFields} nodes { name color } }
          comments(first: ${IMPORT_COMMENTS_PER_PAGE}) { ${pageFields} nodes { body url createdAt ${actorFields} } }
        }
      }
    }
  }`,
  labels: `query ImportIssueLabels($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) { databaseId issue(number: $number) {
      labels(first: ${IMPORT_LABELS_PER_PAGE}, after: $cursor) { ${pageFields} nodes { name color } }
    } }
  }`,
  comments: `query ImportIssueComments($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) { databaseId issue(number: $number) {
      comments(first: ${IMPORT_COMMENTS_PER_PAGE}, after: $cursor) { ${pageFields} nodes { body url createdAt ${actorFields} } }
    } }
  }`,
  pulls: `query ImportPullRequests($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) { databaseId
      pullRequests(first: ${IMPORT_PULLS_PER_PAGE}, after: $cursor, states: OPEN, orderBy: {field: CREATED_AT, direction: ASC}) {
        ${pageFields} nodes { number title body url state createdAt headRefName ${actorFields} }
      }
    }
  }`,
};

export async function fetchImportPage(
  octokit: Awaited<ReturnType<typeof getVerifiedInstallationOctokit>>,
  config: GitHubConfig,
  state: GitHubImportState,
): Promise<unknown> {
  if (state.phase === "complete") throw new Error("Import already completed");
  const cursor =
    state.phase === "issues"
      ? state.issueCursor
      : state.phase === "pulls"
        ? state.pullCursor
        : state.phase === "labels"
          ? state.currentIssue?.labelCursor
          : state.currentIssue?.commentCursor;
  return octokit.graphql(importQueries[state.phase], {
    owner: config.repositoryOwner,
    repo: config.repositoryName,
    cursor,
    ...(state.currentIssue ? { number: state.currentIssue.number } : {}),
  });
}

export function nextCursor(
  info: z.infer<typeof pageInfo>,
  previous: string | null,
) {
  if (info.hasNextPage && (!info.endCursor || info.endCursor === previous))
    throw new Error("GitHub returned a non-advancing import page");
  return info.endCursor;
}
