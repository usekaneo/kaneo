const date = "2026-09-01T10:00:00.000Z";
const user = {
  id: "ui-review-user",
  name: "Alex Morgan",
  email: "alex@example.test",
  emailVerified: true,
  isAnonymous: false,
  image: null,
  locale: "en-US",
  createdAt: date,
  updatedAt: date,
  role: "user",
};
const organization = {
  id: "ui-review-workspace",
  name: "Design studio",
  slug: "design-studio",
  createdAt: date,
  logo: null,
  metadata: null,
};
const member = {
  id: "ui-review-member",
  organizationId: organization.id,
  userId: user.id,
  role: "owner",
  createdAt: date,
  user,
};

const project = {
  id: "ui-review-project",
  workspaceId: organization.id,
  name: "Website redesign",
  slug: "WEB",
  icon: "Globe",
  description: "Synthetic project for UI previews.",
  createdAt: date,
  isPublic: false,
  archivedAt: null,
  position: 0,
  lastTaskNumber: 1,
  statistics: { completionPercentage: 0, totalTasks: 1, dueDate: null },
  archivedTasks: [],
  plannedTasks: [],
  columns: [],
};
const task = {
  id: "ui-review-task",
  projectId: project.id,
  title: "Polish the landing page",
  number: 1,
  description: "Review the layout, typography, and interaction details.",
  status: "in-progress",
  priority: "medium",
  startDate: null,
  dueDate: null,
  position: 0,
  createdAt: date,
  userId: user.id,
  assigneeId: user.id,
  assigneeName: user.name,
  assigneeImage: null,
  labels: [],
  externalLinks: [],
  customFieldValues: [],
};
const columns = [
  {
    id: "ui-review-column",
    projectId: project.id,
    name: "In Progress",
    slug: "in-progress",
    position: 0,
    icon: null,
    color: null,
    isFinal: false,
    createdAt: date,
    updatedAt: date,
    tasks: [task],
  },
];

export function createFixtureSession({
  customFields = false,
  multiselect = false,
} = {}) {
  const field = {
    id: "ui-review-audience",
    projectId: project.id,
    name: "Audience",
    type: multiselect ? "multiselect" : "dropdown",
    required: false,
    defaultValue: null,
    options: ["Design", "Engineering", "Product"],
    position: 0,
    createdAt: date,
    updatedAt: date,
  };
  const fieldValue = {
    id: "ui-review-field-value",
    taskId: task.id,
    fieldId: field.id,
    value: multiselect ? JSON.stringify(["Design"]) : "Design",
    fieldName: field.name,
    fieldType: field.type,
    fieldPosition: 0,
    fieldOptions: field.options,
  };
  const entries = [
    {
      id: "ui-review-time-entry",
      taskId: task.id,
      userId: user.id,
      userName: user.name,
      description: "Layout review",
      startTime: date,
      endTime: "2026-09-01T10:25:00.000Z",
      duration: 1500,
      createdAt: date,
    },
  ];
  return (url, method, body = {}) => {
    const p = new URL(url).pathname;
    if (customFields) {
      if (p === `/api/custom-field/project/${project.id}` && method === "GET")
        return structuredClone([field]);
      if (p === `/api/custom-field/task/${task.id}` && method === "GET")
        return structuredClone([fieldValue]);
      if (p === "/api/custom-field/value" && method === "PUT") {
        if (body.taskId !== task.id || body.fieldId !== field.id)
          return undefined;
        fieldValue.value = body.value;
        return structuredClone(fieldValue);
      }
    }
    if (p === `/api/time-entry/task/${task.id}` && method === "GET")
      return entries.map((entry) => ({ ...entry }));
    if (
      p === "/api/time-entry" &&
      method === "POST" &&
      body.taskId === task.id
    ) {
      const entry = {
        id: `ui-review-time-${entries.length}`,
        taskId: task.id,
        userId: user.id,
        userName: user.name,
        description: body.description ?? null,
        startTime: body.startTime,
        endTime: null,
        duration: null,
        createdAt: body.startTime,
      };
      entries.push(entry);
      return { ...entry };
    }
    if (p.startsWith("/api/time-entry/") && method === "PUT") {
      const entry = entries.find((item) => p === `/api/time-entry/${item.id}`);
      if (!entry) return undefined;
      Object.assign(entry, body, {
        duration: Math.max(
          0,
          Math.floor(
            (Date.parse(body.endTime) - Date.parse(entry.startTime)) / 1000,
          ),
        ),
      });
      return { ...entry };
    }
    return fixture(url, method);
  };
}

export function fixture(url, method) {
  const p = new URL(url).pathname;
  if (p.endsWith("/get-session"))
    return {
      session: {
        id: "ui-review-session",
        token: "synthetic-session",
        userId: user.id,
        activeOrganizationId: organization.id,
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: date,
        updatedAt: date,
      },
      user,
    };
  if (p.endsWith("/organization/list")) return [organization];
  if (p.endsWith("/organization/get-full-organization"))
    return { ...organization, members: [member], invitations: [] };
  if (p.endsWith("/organization/get-active-member")) return member;
  if (p.endsWith("/organization/get-active-member-role"))
    return { role: "owner" };
  if (p.endsWith("/organization/list-members"))
    return { members: [member], total: 1 };
  if (p.endsWith("/list-accounts"))
    return [
      {
        id: "ui-review-account",
        providerId: "credential",
        accountId: user.id,
        userId: user.id,
        createdAt: date,
        updatedAt: date,
      },
    ];
  if (p.endsWith("/config"))
    return {
      disableRegistration: false,
      disableGuestAccess: false,
      isCloud: false,
      billingEnabled: false,
      isEmailConfigured: false,
      auth: { emailAndPassword: true },
    };
  if (p.endsWith("/has-permission")) return { success: true, error: null };
  if (method === "GET") {
    if (p === "/api/project") return [project];
    if (p === `/api/project/${project.id}`) return project;
    if (
      [
        `/api/github-integration/project/${project.id}`,
        `/api/gitea-integration/project/${project.id}`,
      ].includes(p)
    )
      return null;
    if (p === `/api/task/${task.id}`) return task;
    if (p === `/api/task/tasks/${project.id}`)
      return { data: columns, total: 1, page: 1, limit: 50, totalPages: 1 };
    if (p === `/api/column/${project.id}`) return columns;
    if (
      [
        `/api/activity/${task.id}`,
        `/api/workflow-rule/${project.id}`,
        `/api/task-relation/${task.id}`,
        `/api/external-link/task/${task.id}`,
        `/api/custom-field/project/${project.id}`,
        `/api/custom-field/task/${task.id}`,
        `/api/label/task/${task.id}`,
      ].includes(p)
    )
      return [];
  }
  if (/\/label\/workspace\//.test(p)) return [];
  if (/\/billing\/[^/]+$/.test(p))
    return {
      plan: null,
      status: null,
      foundingFree: false,
      currentPeriodEnd: null,
    };
  if (/invitation|notification|api-key|list-sessions/.test(p)) return [];
  if (method !== "GET" && method !== "OPTIONS")
    return { success: true, user, token: null };
  return undefined;
}

export async function installFixtures(context, origin, diagnostics, options) {
  const sessionFixture = createFixtureSession(options);
  await context.addInitScript(() => {
    localStorage.setItem("theme", "light");
    localStorage.setItem("vite-ui-theme", "light");
    localStorage.setItem("i18nextLng", "en-US");
    localStorage.setItem(
      "user-preferences",
      JSON.stringify({
        state: { theme: "light", weekStartsOn: 1 },
        version: 0,
      }),
    );
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:")
      return route.continue();
    const isAPI =
      url.pathname.startsWith("/api/") ||
      url.origin === "http://127.0.0.1:4799";
    if (isAPI) {
      if (request.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": origin,
            "access-control-allow-credentials": "true",
            "access-control-allow-headers": "*",
          },
        });
      const data = sessionFixture(
        request.url(),
        request.method(),
        request.postDataJSON?.() ?? {},
      );
      if (data === undefined)
        diagnostics.unhandled.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({
        status: data === undefined ? 501 : 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
        },
        body: JSON.stringify(
          data === undefined
            ? { error: "No synthetic fixture for this endpoint" }
            : data,
        ),
      });
    }
    if (url.origin === origin && request.method() === "GET")
      return route.continue();
    diagnostics.blocked.push(url.origin + url.pathname);
    return route.abort();
  });
  await context.routeWebSocket("**/*", (ws) => {
    const url = new URL(ws.url());
    if (url.host === new URL(origin).host) ws.connectToServer();
    else ws.close();
  });
}
