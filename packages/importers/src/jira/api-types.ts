export type JiraUser = {
  accountId?: string | null;
  key?: string | null;
  name?: string | null;
  displayName?: string | null;
  emailAddress?: string | null;
};

export type JiraStatusCategory = {
  key?: string | null;
};

export type JiraStatus = {
  id: string;
  name?: string | null;
  statusCategory?: JiraStatusCategory | null;
};

export type JiraIssueTypeStatuses = {
  id?: string;
  name?: string | null;
  statuses?: JiraStatus[] | null;
};

export type JiraProject = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  projectTypeKey?: string | null;
};

export type JiraProjectPage = {
  values?: JiraProject[] | null;
  isLast?: boolean | null;
};

export type JiraBoard = {
  id: number;
  name?: string | null;
  type?: string | null;
  location?: { projectKey?: string | null } | null;
};

export type JiraBoardPage = {
  values?: JiraBoard[] | null;
};

export type JiraBoardColumn = {
  name?: string | null;
  statuses?: Array<{ id: string }> | null;
};

export type JiraBoardConfiguration = {
  columnConfig?: { columns?: JiraBoardColumn[] | null } | null;
};

export type JiraLinkedIssue = {
  id: string;
  key?: string | null;
};

export type JiraIssueLink = {
  type?: {
    name?: string | null;
    inward?: string | null;
    outward?: string | null;
  } | null;
  inwardIssue?: JiraLinkedIssue | null;
  outwardIssue?: JiraLinkedIssue | null;
};

export type JiraIssueFields = {
  summary?: string | null;
  description?: unknown;
  status?: JiraStatus | null;
  priority?: { name?: string | null } | null;
  assignee?: JiraUser | null;
  labels?: string[] | null;
  duedate?: string | null;
  created?: string | null;
  parent?: JiraLinkedIssue | null;
  issuelinks?: JiraIssueLink[] | null;
  attachment?: unknown[] | null;
  comment?: { total?: number | null } | null;
};

export type JiraIssue = {
  id: string;
  key: string;
  fields?: JiraIssueFields | null;
  renderedFields?: { description?: string | null } | null;
};

export type JiraCloudSearchPage = {
  issues?: JiraIssue[] | null;
  nextPageToken?: string | null;
  isLast?: boolean | null;
};

export type JiraServerSearchPage = {
  issues?: JiraIssue[] | null;
  startAt?: number | null;
  total?: number | null;
};

export type JiraComment = {
  id?: string;
  author?: JiraUser | null;
  body?: unknown;
  renderedBody?: string | null;
  created?: string | null;
};

export type JiraCommentPage = {
  comments?: JiraComment[] | null;
  startAt?: number | null;
  total?: number | null;
};
