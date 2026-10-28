export const TEAMS_PAGE_SIZE = 100;
export const STATES_PER_TEAM = 100;
export const ISSUES_PAGE_SIZE = 50;
export const LABELS_PER_ISSUE = 20;
export const RELATIONS_PER_ISSUE = 10;
export const COMMENTS_PAGE_SIZE = 100;

export const VIEWER_QUERY = `query ImportViewer {
  viewer { id name email }
}`;

export const TEAMS_QUERY = `query ImportTeams($after: String) {
  teams(first: ${TEAMS_PAGE_SIZE}, after: $after) {
    nodes { id key name issueCount }
    pageInfo { hasNextPage endCursor }
  }
}`;

export const TEAM_QUERY = `query ImportTeam($teamId: String!) {
  team(id: $teamId) {
    id
    key
    name
    description
    states(first: ${STATES_PER_TEAM}) {
      nodes { id name type position color }
    }
  }
}`;

export const ISSUES_QUERY = `query ImportIssues($teamId: ID!, $after: String) {
  issues(
    first: ${ISSUES_PAGE_SIZE}
    after: $after
    includeArchived: false
    filter: { team: { id: { eq: $teamId } } }
  ) {
    nodes {
      id
      number
      title
      description
      priority
      dueDate
      sortOrder
      createdAt
      state { id }
      assignee { name email }
      parent { id }
      labels(first: ${LABELS_PER_ISSUE}) {
        nodes { id name color parent { name } }
        pageInfo { hasNextPage }
      }
      relations(first: ${RELATIONS_PER_ISSUE}) {
        nodes { type relatedIssue { id } }
        pageInfo { hasNextPage }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

export const COMMENTS_QUERY = `query ImportComments($teamId: ID!, $after: String) {
  comments(
    first: ${COMMENTS_PAGE_SIZE}
    after: $after
    filter: { issue: { team: { id: { eq: $teamId } } } }
  ) {
    nodes {
      body
      createdAt
      user { name email }
      botActor { name }
      issue { id }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;
