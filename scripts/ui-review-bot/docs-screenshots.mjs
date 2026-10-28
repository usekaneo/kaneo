import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { fixture, installFixtures } from "./fixtures.mjs";
import { api, fulfillJSON, origin, root, startWebApp } from "./web-app.mjs";

// Real frontend, fictional data. The fixture layer blocks all live API traffic.
const output = `${root}apps/docs/images/product`;
const workspaceId = "ui-review-workspace";
const projectId = "ui-review-project";
const date = "2026-09-23T10:00:00.000Z";
const people = ["Alex Morgan", "Jamie Chen", "Sam Rivera"].map((name, i) => ({
  ...fixture(`${api}/api/auth/get-session`, "GET").user,
  id: i === 0 ? "ui-review-user" : `docs-person-${i}`,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@example.test`,
}));
const members = people.map((user, i) => ({
  id: `docs-member-${i}`,
  organizationId: workspaceId,
  userId: user.id,
  role: i === 0 ? "owner" : "member",
  createdAt: date,
  user,
}));
const project = {
  ...fixture(`${api}/api/project/${projectId}`, "GET"),
  name: "Website launch",
};
const labels = [
  ["Design", "#a78bfa"],
  ["Engineering", "#60a5fa"],
  ["Content", "#fbbf24"],
].map(([name, color], i) => ({
  id: `docs-label-${i}`,
  workspaceId,
  name,
  color,
}));
const columns = ["To Do", "In Progress", "In Review", "Done"].map(
  (name, i) => ({
    ...fixture(`${api}/api/column/${projectId}`, "GET")[0],
    id: `docs-column-${i}`,
    name,
    position: i,
    isFinal: i === 3,
    tasks: [],
  }),
);
const plannedTasks = [
  "Explore a customer stories page",
  "Plan the next accessibility review",
  "Translate the launch announcement",
].map((title, i) => ({
  ...fixture(`${api}/api/task/ui-review-task`, "GET"),
  id: `docs-planned-${i}`,
  number: 40 + i,
  title,
  status: "planned",
  columnId: null,
  position: i,
  priority: i === 0 ? "medium" : "low",
  labels: [labels[i]],
}));
project.columns = columns;
project.plannedTasks = plannedTasks;
const views = [
  [
    "backlog",
    `/dashboard/workspace/${workspaceId}/project/${projectId}/backlog`,
    "Explore a customer stories page",
  ],
  ["members", `/dashboard/workspace/${workspaceId}/members`, "Jamie Chen"],
  ["workflow", `/dashboard/settings/projects/${projectId}/workflow`, "Columns"],
  ["labels", "/dashboard/settings/workspace/labels", "Engineering"],
  [
    "integrations",
    `/dashboard/settings/projects/${projectId}/integrations`,
    "Telegram Integration",
  ],
  [
    "notifications",
    "/dashboard/settings/account/notifications",
    "Task assignments",
  ],
  ["security", "/dashboard/settings/account/security", "Current password"],
];
await mkdir(output, { recursive: true });
const server = await startWebApp();
let browser;
try {
  browser = await chromium.launch();
  for (const theme of ["light", "dark"]) {
    for (const [view, path, readyText] of views) {
      if (
        process.env.DOCS_SCREENSHOT_VIEW &&
        process.env.DOCS_SCREENSHOT_VIEW !== view
      )
        continue;
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        deviceScaleFactor: 2,
        locale: "en-US",
        timezoneId: "UTC",
        colorScheme: theme,
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      const diagnostics = { unhandled: [], blocked: [] };
      await installFixtures(context, origin, diagnostics);
      await context.addInitScript((theme) => {
        localStorage.setItem(
          "user-preferences",
          JSON.stringify({ state: { theme }, version: 0 }),
        );
      }, theme);
      await context.route("**/api/**", async (route) => {
        const request = route.request();
        const p = new URL(request.url()).pathname;
        let data;
        if (p === "/api/user/security") data = { hasPassword: true };
        else if (p.replace(/\/$/, "") === "/api/notification-preferences")
          data = {
            emailAddress: "alex@example.test",
            emailEnabled: false,
            ntfyEnabled: false,
            ntfyConfigured: false,
            ntfyServerUrl: null,
            ntfyTopic: null,
            ntfyTokenConfigured: false,
            maskedNtfyToken: null,
            gotifyEnabled: false,
            gotifyConfigured: false,
            gotifyServerUrl: null,
            gotifyTokenConfigured: false,
            maskedGotifyToken: null,
            webhookEnabled: false,
            webhookConfigured: false,
            webhookUrl: null,
            webhookSecretConfigured: false,
            maskedWebhookSecret: null,
            taskAssignmentEnabled: true,
            taskCommentEnabled: true,
            taskStatusChangeEnabled: true,
            dueDateReminderEnabled: true,
            dueDateReminderLeadTimeMinutes: 1440,
            workspaces: [],
            createdAt: date,
            updatedAt: date,
          };
        else if (p === "/api/project") data = [project];
        else if (p === `/api/project/${projectId}`) data = project;
        else if (p === `/api/task/tasks/${projectId}`)
          data = {
            data: project,
            pagination: {
              page: 1,
              pageSize: 50,
              totalPages: 1,
              total: plannedTasks.length,
            },
          };
        else if (p === `/api/column/${projectId}`) data = columns;
        else if (
          p === `/api/custom-field/project/${projectId}/values` ||
          p === `/api/custom-field/project/${projectId}/filter-values`
        )
          data = [];
        else if (p.endsWith("/organization/list-invitations"))
          data = [
            {
              id: "docs-invitation",
              organizationId: workspaceId,
              email: "taylor@example.test",
              role: "member",
              status: "pending",
              inviterId: people[0].id,
              createdAt: date,
              expiresAt: "2026-09-30T10:00:00.000Z",
            },
          ];
        else if (p.endsWith("/organization/list-members"))
          data = { members, total: members.length };
        else if (p.endsWith("/organization/list-roles")) data = [];
        else if (p.endsWith("/organization/get-full-organization"))
          data = {
            ...fixture(request.url(), request.method()),
            name: "Studio North",
            members,
          };
        else if (p.endsWith("/organization/list"))
          data = fixture(request.url(), request.method()).map((o) => ({
            ...o,
            name: "Studio North",
          }));
        else if (p === `/api/label/workspace/${workspaceId}`) data = labels;
        if (data === undefined || request.method() === "OPTIONS")
          return route.fallback();
        await fulfillJSON(route, data);
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(date));
      await page.goto(`${origin}${path}`);
      await page.getByText(readyText, { exact: true }).first().waitFor();
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: `${output}/${view}-${theme}.png`,
        animations: "disabled",
      });
      console.log(JSON.stringify({ view, theme, errors, ...diagnostics }));
      assert.deepEqual(errors, []);
      assert.deepEqual(diagnostics.unhandled, []);
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
