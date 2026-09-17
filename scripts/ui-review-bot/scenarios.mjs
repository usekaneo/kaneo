import { validatePlan } from "./core.mjs";

export function checkSupportedSurface(files) {
  if (
    files.some(
      ({ path }) =>
        path.startsWith("apps/site/") || path.startsWith("apps/docs/"),
    ) &&
    !files.some(
      ({ path }) =>
        path.startsWith("apps/web/src/") && !path.endsWith("/main.tsx"),
    )
  ) {
    throw new Error(
      "This PR changes the marketing site or docs. Peekareq currently previews apps/web only; refusing unrelated app screenshots.",
    );
  }
}

export function customFieldPlan(collapsible) {
  const route =
    "/dashboard/workspace/ui-review-workspace/project/ui-review-project/task/ui-review-task";
  const click = (name, by = "text", role = "button") => ({
    type: "click",
    by,
    role,
    name,
    only: "after",
  });
  const open = [
    ...(collapsible ? [click("Custom Fields")] : []),
    click("Design"),
  ];
  const focus = { by: "text", name: "Custom Fields" };
  const audience = { by: "text", name: "Audience" };
  return validatePlan({
    summary:
      "Synthetic Audience field: project configuration, available options, and multiple selected values. Base uses a dropdown when multiselect is unavailable.",
    scenarios: [
      {
        name: "Multiselect field configuration",
        reason: "Project settings show the field type and available options.",
        beforePath: "/dashboard/settings/projects/ui-review-project/workflow",
        afterPath: "/dashboard/settings/projects/ui-review-project/workflow",
        actions: [],
        focus: { by: "role", role: "heading", name: "Custom Fields" },
        visible: [audience],
      },
      {
        name: "Choose from multiple options",
        reason: "Expanded Audience multiselect with synthetic options.",
        beforePath: route,
        afterPath: route,
        actions: open,
        focus,
        visible: [
          audience,
          { by: "role", role: "option", name: "Engineering" },
        ],
      },
      {
        name: "Design and Engineering selected",
        reason: "Audience with Design and Engineering selected.",
        beforePath: route,
        afterPath: route,
        focus,
        visible: [audience, { by: "text", name: "Engineering" }],
        actions: [
          ...open,
          click("Engineering", "role", "option"),
          {
            type: "press",
            by: "role",
            role: "option",
            name: "Engineering",
            value: "Escape",
            only: "after",
          },
          click("Audience"),
        ],
      },
    ],
  });
}

export function timeTrackingPlan() {
  const route =
    "/dashboard/workspace/ui-review-workspace/project/ui-review-project/task/ui-review-task";
  const click = (name) => ({
    type: "click",
    by: "role",
    role: "button",
    name,
    only: "after",
  });
  const target = (name) => ({ by: "role", role: "button", name });
  const open = click("Time tracking");
  const start = click("Start timer");
  return validatePlan({
    summary:
      "Synthetic time entries: expanded history, a running timer, and the saved entry after stopping.",
    scenarios: [
      {
        name: "Logged time entries",
        actions: [open],
        visible: [target("Start timer")],
      },
      {
        name: "Timer running",
        actions: [open, start],
        visible: [target("Stop timer")],
      },
      {
        name: "Timer stopped and entry saved",
        actions: [open, start, click("Stop timer")],
        visible: [target("Start timer")],
      },
    ].map((scenario) => ({
      ...scenario,
      beforePath: route,
      afterPath: route,
      focus: target("Time tracking"),
      visible: [...scenario.visible, { by: "text", name: "Layout review" }],
    })),
  });
}
