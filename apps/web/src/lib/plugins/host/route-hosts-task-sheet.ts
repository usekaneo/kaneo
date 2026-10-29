const TASK_SHEET_ROUTE =
  /\/project\/\$projectId\/(board|backlog|calendar|plugin\/\$pluginId\/\$viewId)$/;

export function routeHostsTaskSheet(routeId: string | undefined): boolean {
  return routeId !== undefined && TASK_SHEET_ROUTE.test(routeId);
}
