import type { PermissionRequirement } from "@kaneo/plugin-sdk/server";
import type { MiddlewareHandler } from "hono";
import { every } from "hono/combine";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import {
  workspaceAccess,
  workspaceAccessMiddleware,
} from "../../utils/workspace-access-middleware";
import { isPluginEnabled } from "../data/workspace-plugins";
import type { EnablementPlugin } from "../enablement/resolve-enabled";
import { toPermissionMap } from "./permission-map";

type GuardKind = "workspace" | "project" | "task";

type Guard = (
  param?: string,
  permissions?: PermissionRequirement,
) => MiddlewareHandler;

const DEFAULT_PARAMS: Record<GuardKind, string> = {
  workspace: "workspaceId",
  project: "projectId",
  task: "taskId",
};

function resolveWorkspace(kind: GuardKind, param: string): MiddlewareHandler {
  switch (kind) {
    case "workspace":
      return workspaceAccess.fromParam(param);
    case "project":
      return workspaceAccess.fromProject(param);
    case "task":
      return workspaceAccessMiddleware({
        sources: [{ type: "lookup", resource: "task", idKey: param }],
      });
  }
}

export function requirePluginEnabled(
  plugin: EnablementPlugin,
): MiddlewareHandler {
  return async (c, next) => {
    if (!(await isPluginEnabled(plugin, c.get("workspaceId")))) {
      return c.json(
        { message: "This plugin is not enabled in this workspace" },
        404,
      );
    }
    await next();
  };
}

export function createPluginGuards(
  plugin: EnablementPlugin,
): Record<GuardKind, Guard> {
  const guard =
    (kind: GuardKind): Guard =>
    (param, permissions) => {
      const required = toPermissionMap(permissions);
      return every(
        resolveWorkspace(kind, param ?? DEFAULT_PARAMS[kind]),
        ...(required ? [requireWorkspacePermission(required)] : []),
        requirePluginEnabled(plugin),
      );
    };

  return {
    workspace: guard("workspace"),
    project: guard("project"),
    task: guard("task"),
  };
}
