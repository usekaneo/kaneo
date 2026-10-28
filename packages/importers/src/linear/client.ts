import type { FetchLike } from "../types.js";
import { createLinearGraphQL, type LinearGraphQL } from "./graphql.js";
import {
  COMMENTS_QUERY,
  ISSUES_QUERY,
  TEAM_QUERY,
  TEAMS_QUERY,
  VIEWER_QUERY,
} from "./queries.js";

export type LinearPageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

export type LinearConnection<T> = {
  nodes: T[];
  pageInfo: LinearPageInfo;
};

export type LinearViewer = {
  id: string;
  name: string | null;
  email: string | null;
};

export type LinearTeamSummary = {
  id: string;
  key: string;
  name: string;
  issueCount: number | null;
};

export type LinearWorkflowState = {
  id: string;
  name: string;
  type: string;
  position: number;
  color: string | null;
};

export type LinearTeam = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  states: { nodes: LinearWorkflowState[] };
};

export type LinearUser = {
  name: string | null;
  email: string | null;
};

export type LinearLabel = {
  id: string;
  name: string;
  color: string | null;
  parent: { name: string } | null;
};

export type LinearRelation = {
  type: string;
  relatedIssue: { id: string } | null;
};

export type LinearIssue = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  priority: number | null;
  dueDate: string | null;
  sortOrder: number | null;
  createdAt: string | null;
  state: { id: string } | null;
  assignee: LinearUser | null;
  parent: { id: string } | null;
  labels: { nodes: LinearLabel[]; pageInfo: { hasNextPage: boolean } };
  relations: { nodes: LinearRelation[]; pageInfo: { hasNextPage: boolean } };
};

export type LinearComment = {
  body: string | null;
  createdAt: string | null;
  user: LinearUser | null;
  botActor: { name: string | null } | null;
  issue: { id: string } | null;
};

export type LinearClientOptions = {
  apiKey: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
};

export class LinearClient {
  private readonly options: LinearClientOptions;
  private readonly graphql: LinearGraphQL;

  constructor(options: LinearClientOptions) {
    this.options = options;
    this.graphql = createLinearGraphQL(options);
  }

  withSignal(signal: AbortSignal | undefined): LinearClient {
    if (!signal) return this;
    const current = this.options.signal;
    return new LinearClient({
      ...this.options,
      signal: current ? AbortSignal.any([current, signal]) : signal,
    });
  }

  async viewer(): Promise<LinearViewer> {
    const data = await this.graphql<{ viewer: LinearViewer }>(VIEWER_QUERY);
    return data.viewer;
  }

  listTeams(): Promise<LinearTeamSummary[]> {
    return this.collect<
      { teams: LinearConnection<LinearTeamSummary> },
      LinearTeamSummary
    >(TEAMS_QUERY, {}, (data) => data.teams);
  }

  async getTeam(teamId: string): Promise<LinearTeam> {
    const data = await this.graphql<{ team: LinearTeam }>(TEAM_QUERY, {
      teamId,
    });
    return data.team;
  }

  listIssues(
    teamId: string,
    onPage?: (count: number) => void,
  ): Promise<LinearIssue[]> {
    return this.collect<{ issues: LinearConnection<LinearIssue> }, LinearIssue>(
      ISSUES_QUERY,
      { teamId },
      (data) => data.issues,
      onPage,
    );
  }

  listComments(
    teamId: string,
    onPage?: (count: number) => void,
  ): Promise<LinearComment[]> {
    return this.collect<
      { comments: LinearConnection<LinearComment> },
      LinearComment
    >(COMMENTS_QUERY, { teamId }, (data) => data.comments, onPage);
  }

  private async collect<Data, Node>(
    query: string,
    variables: Record<string, unknown>,
    select: (data: Data) => LinearConnection<Node>,
    onPage?: (count: number) => void,
  ): Promise<Node[]> {
    const nodes: Node[] = [];
    let after: string | null = null;
    do {
      const connection = select(
        await this.graphql<Data>(query, { ...variables, after }),
      );
      nodes.push(...connection.nodes);
      onPage?.(nodes.length);
      after = connection.pageInfo.hasNextPage
        ? connection.pageInfo.endCursor
        : null;
    } while (after);
    return nodes;
  }
}
