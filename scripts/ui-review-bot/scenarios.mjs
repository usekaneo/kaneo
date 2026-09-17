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
  return validatePlan({
    summary:
      "Synthetic Audience field: task overview, available options, and multiple selected values. Base uses a dropdown when multiselect is unavailable.",
    scenarios: [
      {
        name: "Task overview",
        reason: "Initial task layout with the custom-field section.",
        beforePath: route,
        afterPath: route,
        actions: [],
      },
      {
        name: "Custom-field options",
        reason: "Expanded Audience multiselect with synthetic options.",
        beforePath: route,
        afterPath: route,
        actions: open,
      },
      {
        name: "Multiple selected values",
        reason: "Audience with Design and Engineering selected.",
        beforePath: route,
        afterPath: route,
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
        ],
      },
    ],
  });
}
