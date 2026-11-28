import type {
  PermissionRequirement,
  PluginGuards,
} from "@kaneo/plugin-sdk/server";
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

export function createPluginGuards(plugin: EnablementPlugin): PluginGuards {
  const guard = (
    resolveWorkspace: MiddlewareHandler,
    permissions?: PermissionRequirement,
  ) => {
    const required = toPermissionMap(permissions);
    return every(
      resolveWorkspace,
      ...(required ? [requireWorkspacePermission(required)] : []),
      requirePluginEnabled(plugin),
    );
  };

  return {
    workspace: (param, permissions) =>
      guard(workspaceAccess.fromParam(param ?? "workspaceId"), permissions),
    project: (param, permissions) =>
      guard(workspaceAccess.fromProject(param ?? "projectId"), permissions),
    task: (param, permissions, { projectParam } = {}) =>
      guard(
        workspaceAccessMiddleware({
          sources: [
            {
              type: "lookup",
              resource: "task",
              idKey: param ?? "taskId",
              projectParam,
            },
          ],
        }),
        permissions,
      ),
  };
}
