import { fixture } from "./fixtures.mjs";
import { api } from "./web-app.mjs";

export const date = "2026-09-23T10:00:00.000Z";
export const workspaceId = "ui-review-workspace";
export const projectId = "ui-review-project";
const createdAt = "2026-09-01T10:00:00.000Z";
const day = (d) => `2026-09-${String(d).padStart(2, "0")}T12:00:00.000Z`;

const baseUser = fixture(`${api}/api/auth/get-session`, "GET").user;
export const people = Object.fromEntries(
  [
    ["AM", "Alex Morgan", "ui-review-user"],
    ["JC", "Jamie Chen", "product-person-jc"],
    ["SR", "Sam Rivera", "product-person-sr"],
    ["TR", "Taylor Reed", "product-person-tr"],
  ].map(([initials, name, id]) => [
    initials,
    {
      ...baseUser,
      id,
      name,
      email: `${name.split(" ")[0].toLowerCase()}@example.test`,
    },
  ]),
);
export const members = Object.values(people).map((user, i) => ({
  id: `product-member-${i}`,
  organizationId: workspaceId,
  userId: user.id,
  role: i === 0 ? "owner" : "member",
  createdAt,
  user,
}));
export const workspace = {
  ...fixture(`${api}/api/auth/organization/list`, "GET")[0],
  name: "Studio North",
  slug: "studio-north",
};

export const labels = Object.fromEntries(
  [
    ["Engineering", "#60a5fa"],
    ["Bug", "#f87171"],
    ["Content", "#fbbf24"],
    ["Design", "#a78bfa"],
    ["Performance", "#22d3ee"],
    ["Research", "#34d399"],
  ].map(([name, color]) => [
    name,
    { id: `product-label-${name.toLowerCase()}`, workspaceId, name, color },
  ]),
);

export const columns = [
  ["to-do", "To Do"],
  ["in-progress", "In Progress"],
  ["in-review", "In Review"],
  ["done", "Done"],
].map(([slug, name], position) => ({
  id: slug,
  projectId,
  name,
  slug,
  position,
  icon: null,
  color: null,
  isFinal: slug === "done",
  createdAt,
  updatedAt: createdAt,
}));

const homepageDescription = `## A clearer first impression

The new layout is in. Keep the customer story above the fold on mobile; the video can come after it.

- [x] Build the responsive hero and navigation
- [x] Add the product walkthrough
- [ ] Check the mobile spacing
- [ ] Get the final copy from Sam
`;

const checklist = (items, done) =>
  items.map((item, i) => `- [${i < done ? "x" : " "}] ${item}`).join("\n");

const rows = [
  [
    "to-do",
    31,
    "Redirect the old pricing links",
    "AM",
    ["Engineering", "Bug"],
    "high",
    22,
    22,
  ],
  [
    "to-do",
    27,
    "Draft the launch email",
    "SR",
    ["Content"],
    "medium",
    25,
    29,
    checklist(
      ["Outline the story", "Write the first draft", "Send it to Alex"],
      1,
    ),
  ],
  [
    "to-do",
    36,
    "A quieter success state for the contact form",
    "JC",
    ["Design"],
    "low",
  ],
  ["to-do", 38, "Do we still need the FAQ?", null, [], "no-priority"],
  [
    "to-do",
    33,
    "Customer quotes: ask Maya for approval",
    null,
    ["Content"],
    "medium",
    28,
    28,
  ],
  [
    "in-progress",
    22,
    "Build the new homepage",
    "JC",
    ["Design", "Engineering"],
    "high",
    16,
    25,
    homepageDescription,
  ],
  [
    "in-progress",
    35,
    "Safari: mobile menu stays open after navigation",
    "TR",
    ["Bug"],
    "urgent",
    23,
    23,
  ],
  [
    "in-progress",
    29,
    "Get the hero video under 2 MB",
    "TR",
    ["Engineering", "Performance"],
    "medium",
    22,
    24,
  ],
  [
    "in-review",
    24,
    "Pricing copy: final review",
    "SR",
    ["Content"],
    "high",
    18,
    24,
  ],
  [
    "done",
    8,
    "Five customer interviews",
    "AM",
    ["Research"],
    "medium",
    7,
    16,
    checklist(["Book the calls", "Run the interviews", "Share the notes"], 3),
  ],
  ["done", 14, "Pick the typefaces", "JC", ["Design"], "low", 11, 12],
  [
    "done",
    19,
    "Remove the unused font weights",
    "TR",
    ["Performance"],
    "no-priority",
  ],
  ["done", 11, "Agree on the launch scope", "AM", [], "high", 9, 10],
];

export const tasks = rows.map(
  (
    [
      status,
      number,
      title,
      assignee,
      taskLabels,
      priority,
      start,
      due,
      description = null,
    ],
    i,
  ) => {
    const user = assignee ? people[assignee] : null;
    return {
      id: `product-task-${number}`,
      title,
      number,
      description,
      status,
      columnId: status,
      priority,
      startDate: start ? day(start) : null,
      dueDate: due ? day(due) : null,
      recurrence: null,
      position: i,
      createdAt,
      userId: user?.id ?? null,
      assigneeName: user?.name ?? null,
      assigneeId: user?.id ?? null,
      assigneeImage: null,
      projectId,
      subtaskCounts: { completed: 0, total: 0 },
      labels: taskLabels.map((name) => {
        const { id, color } = labels[name];
        return { id, name, color };
      }),
      externalLinks: [],
    };
  },
);
const byNumber = (number) => tasks.find((task) => task.number === number);
export const homepageTask = byNumber(22);
const homepageSubtasks = [byNumber(29), byNumber(19)];
homepageTask.subtaskCounts = {
  completed: homepageSubtasks.filter((task) => task.status === "done").length,
  total: homepageSubtasks.length,
};
homepageTask.externalLinks = [
  {
    id: "product-link-pr",
    taskId: homepageTask.id,
    integrationId: "product-github",
    resourceType: "pull_request",
    externalId: "142",
    url: "https://github.com/studio-north/website/pull/142",
    title: "New homepage layout",
    metadata: { merged: false, draft: false },
    createdAt,
    updatedAt: createdAt,
  },
];
export const relations = [
  ...homepageSubtasks.map((task) => [task, "subtask"]),
  [byNumber(27), "blocks"],
].map(([task, relationType]) => ({
  id: `product-relation-${task.number}`,
  sourceTaskId: homepageTask.id,
  targetTaskId: task.id,
  relationType,
  createdAt,
}));
export const relatedTask = (task) => ({
  id: task.id,
  title: task.title,
  status: task.status,
  isCompleted: task.status === "done",
  priority: task.priority,
  number: task.number,
  projectId,
  userId: task.userId,
  assigneeName: task.assigneeName,
});

export const project = {
  ...fixture(`${api}/api/project/${projectId}`, "GET"),
  name: "Website launch",
  slug: "WEB",
  lastTaskNumber: 38,
  statistics: {
    completionPercentage: 31,
    totalTasks: tasks.length,
    dueDate: day(30),
  },
};
export const board = {
  id: projectId,
  name: project.name,
  slug: project.slug,
  icon: project.icon,
  description: project.description,
  isPublic: false,
  workspaceId,
  backgroundVersion: null,
  columns: columns.map(({ id, slug, name, icon, isFinal, position }) => ({
    id,
    slug,
    name,
    icon,
    isFinal,
    position,
    tasks: tasks.filter((task) => task.status === slug),
  })),
  archivedTasks: [],
  plannedTasks: [],
};

export const comments = [
  {
    id: "product-comment-1",
    taskId: homepageTask.id,
    type: "comment",
    createdAt: "2026-09-23T09:00:00.000Z",
    updatedAt: "2026-09-23T09:00:00.000Z",
    userId: people.SR.id,
    content:
      "The shorter headline reads much better on mobile. I'll send the approved customer quote this afternoon.",
    eventData: null,
    externalUserName: null,
    externalUserAvatar: null,
    externalSource: null,
    externalUrl: null,
  },
];
