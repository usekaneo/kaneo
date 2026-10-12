import type { TaskComment } from "../api/comments.js";
import type { Column, Project } from "../api/schemas.js";
import type {
  RelatedTask,
  TaskRelationWithTasks,
} from "../api/task-relations.js";
import type { TimeEntryWithUser } from "../api/time-entries.js";
import { externalLink } from "../external-links/test-links.js";
import type { ResolvedTask } from "../tasks/resolve-task.js";
import { loaded } from "./section-result.js";
import type { TaskViewSections } from "./task-view-sections.js";

export const viewNow = new Date(2026, 9, 7, 12, 0, 0);

const at = (days: number, hours = 0) =>
  new Date(2026, 9, 7 + days, 12 + hours, 0, 0).toISOString();

export const webUrl = "https://kaneo.test";

const project: Project = {
  id: "p1",
  workspaceId: "ws_1",
  slug: "kan",
  name: "Kaneo Web",
  icon: null,
  description: null,
  archivedAt: null,
  position: 0,
  lastTaskNumber: 30,
};

const columns: ReadonlyArray<Column> = [
  {
    id: "c1",
    projectId: "p1",
    name: "To Do",
    slug: "to-do",
    position: 0,
    color: null,
    isFinal: false,
  },
  {
    id: "c2",
    projectId: "p1",
    name: "In Progress",
    slug: "in-progress",
    position: 1,
    color: null,
    isFinal: false,
  },
  {
    id: "c3",
    projectId: "p1",
    name: "Done",
    slug: "done",
    position: 2,
    color: null,
    isFinal: true,
  },
];

export const resolvedTask: ResolvedTask = {
  task: {
    id: "t12",
    projectId: "p1",
    workspaceId: "ws_1",
    number: 12,
    title: "Fix login redirect after device approval",
    description: [
      "## Steps",
      "",
      "1. Sign in with the **device** flow",
      "2. Approve in the browser",
      "",
      "![Redirect loop](/api/asset/redirect.png)",
    ].join("\n"),
    status: "in-progress",
    priority: "urgent",
    startDate: at(-6),
    dueDate: at(2),
    createdAt: at(-8),
    assigneeId: "u1",
    assigneeName: "Ada Lovelace",
  },
  workspaceId: "ws_1",
  project,
  columns,
  ticketId: "KAN-12",
  url: `${webUrl}/dashboard/workspace/ws_1/project/p1/task/t12`,
};

const related = (
  id: string,
  number: number,
  title: string,
  status = "to-do",
  projectId = "p1",
): RelatedTask => ({
  id,
  title,
  status,
  isCompleted: status === "done",
  number,
  projectId,
});

const me = related("t12", 12, "Fix login redirect after device approval");

let relationId = 0;
const relation = (
  source: RelatedTask,
  target: RelatedTask,
  relationType: string,
): TaskRelationWithTasks => ({
  id: `r${++relationId}`,
  sourceTaskId: source.id,
  targetTaskId: target.id,
  relationType,
  sourceTask: source,
  targetTask: target,
});

export const relationsFixture: ReadonlyArray<TaskRelationWithTasks> = [
  relation(related("t4", 4, "Auth overhaul"), me, "subtask"),
  relation(me, related("t13", 13, "Reproduce on Safari", "done"), "subtask"),
  relation(me, related("t14", 14, "Add a regression test", "done"), "subtask"),
  relation(
    me,
    related("t15", 15, "Handle expired device codes", "in-progress"),
    "subtask",
  ),
  relation(me, related("t16", 16, "Update the login docs"), "subtask"),
  relation(
    me,
    related("t17", 17, "Clean up the redirect helper and its callers"),
    "subtask",
  ),
  relation(related("t9", 9, "Session cookie on the API domain"), me, "blocks"),
  relation(me, related("t20", 20, "Release 2.36"), "blocks"),
  relation(me, related("m3", 3, "Mobile sign in", "to-do", "p2"), "related"),
];

const comment = (
  id: string,
  name: string,
  content: string,
  createdAt: string,
  updatedAt = createdAt,
): TaskComment => ({
  id,
  taskId: "t12",
  userId: name === "Ada Lovelace" ? "u1" : "u2",
  content,
  createdAt,
  updatedAt,
  user: { name },
});

export const commentsFixture: ReadonlyArray<TaskComment> = [
  comment("c1", "Grace Hopper", "Seeing this on staging too.", at(-5)),
  comment("c2", "Ada Lovelace", "Bisecting now.", at(-4)),
  comment(
    "c3",
    "Grace Hopper",
    "It started with the cookie change.\n\nThe callback URL drops the **state** param when the device page redirects, so the CLI never sees the approval and keeps polling until the code expires.",
    at(-1),
  ),
  comment(
    "c4",
    "Ada Lovelace",
    "First pass is up, please review.",
    at(0, -3),
    at(0, -2),
  ),
  comment(
    "c5",
    "Grace Hopper",
    "Looks good. One question:\n\n- do we still need the fallback?\n- can we drop the retry?\n- what about older servers?\n- and API keys?",
    at(0, -1),
  ),
];

const entry = (
  id: string,
  startTime: string,
  endTime: string | null,
  duration: number | null,
): TimeEntryWithUser => ({
  id,
  taskId: "t12",
  userId: "u1",
  description: null,
  startTime,
  endTime,
  duration,
  userName: "Ada Lovelace",
});

export const timeFixture: ReadonlyArray<TimeEntryWithUser> = [
  entry("e1", at(-2), at(-2, 2), 7200),
  entry("e2", at(0, -1), null, null),
];

export const sectionsFixture: TaskViewSections = {
  labels: loaded([
    {
      id: "l1",
      name: "bug",
      color: "red",
      taskId: "t12",
      workspaceId: "ws_1",
    },
    {
      id: "l2",
      name: "auth",
      color: "#8e51ff",
      taskId: "t12",
      workspaceId: "ws_1",
    },
  ]),
  relations: loaded(relationsFixture),
  links: loaded([
    externalLink({
      id: "x1",
      taskId: "t12",
      url: "https://github.com/usekaneo/kaneo/pull/1960",
      title: "fix(auth): keep state on device redirect",
      resourceType: "pull_request",
      integrationId: "i1",
      integration: { id: "i1", type: "github" },
    }),
    externalLink({
      id: "x2",
      taskId: "t12",
      url: "https://sentry.io/issues/4211/",
    }),
  ]),
  fields: loaded([
    {
      fieldId: "f2",
      value: '["Web","CLI"]',
      fieldName: "Platforms",
      fieldType: "multiselect",
      fieldPosition: 1,
    },
    {
      fieldId: "f1",
      value: "5",
      fieldName: "Story points",
      fieldType: "number",
      fieldPosition: 0,
    },
    {
      fieldId: "f3",
      value: "",
      fieldName: "Customer",
      fieldType: "text",
      fieldPosition: 2,
    },
  ]),
  time: loaded(timeFixture),
  comments: loaded(commentsFixture),
};

export const projectSlugsFixture: ReadonlyMap<string, string> = new Map([
  ["p1", "kan"],
  ["p2", "mob"],
]);
