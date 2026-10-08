import { z } from "../../openapi";

export const listPluginsQuery = z.object({
  workspaceId: z.string().min(1).optional().openapi({
    description:
      "Include whether each plugin is enabled in this workspace, and its settings. Requires membership.",
  }),
});

export const pluginWorkspaceParams = z.object({
  pluginId: z.string(),
  workspaceId: z.string(),
});

export const updateWorkspacePluginBody = z
  .object({
    enabled: z.boolean().optional(),
    settings: z.record(z.string(), z.unknown()).optional().openapi({
      description:
        "All settings values for the workspace. Omitted secret fields keep their stored value; other omitted fields are cleared.",
    }),
  })
  .openapi("UpdateWorkspacePlugin");
