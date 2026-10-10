import { z } from "../../openapi";

const selectOptionSchema = z.object({ value: z.string(), label: z.string() });

const fieldBase = {
  label: z.string(),
  description: z.string().optional(),
};

export const pluginSettingFieldSchema = z
  .discriminatedUnion("type", [
    z.object({
      ...fieldBase,
      type: z.literal("text"),
      placeholder: z.string().optional(),
      multiline: z.boolean().optional(),
      required: z.boolean().optional(),
      default: z.string().optional(),
    }),
    z.object({
      ...fieldBase,
      type: z.literal("secret"),
      placeholder: z.string().optional(),
      required: z.boolean().optional(),
    }),
    z.object({
      ...fieldBase,
      type: z.literal("number"),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().optional(),
      required: z.boolean().optional(),
      default: z.number().optional(),
    }),
    z.object({
      ...fieldBase,
      type: z.literal("boolean"),
      default: z.boolean().optional(),
    }),
    z.object({
      ...fieldBase,
      type: z.literal("select"),
      options: z.array(selectOptionSchema).readonly(),
      required: z.boolean().optional(),
      default: z.string().optional(),
    }),
    z.object({
      ...fieldBase,
      type: z.literal("multiselect"),
      options: z.array(selectOptionSchema).readonly(),
      default: z.array(z.string()).readonly().optional(),
    }),
  ])
  .openapi("PluginSettingField");

export const workspacePluginStateSchema = z
  .object({
    enabled: z.boolean(),
    settings: z.record(z.string(), z.unknown()).openapi({
      description: "Current settings values. Secret fields are never returned.",
    }),
    configuredSecrets: z.array(z.string()).openapi({
      description: "Secret fields that have a stored value.",
    }),
  })
  .openapi("WorkspacePluginState");

export const pluginSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    packageName: z.string(),
    version: z.string(),
    description: z.string().nullable(),
    official: z.boolean().openapi({
      description:
        "Ships with Kaneo. Official plugins are enabled in every workspace until a workspace admin turns them off.",
    }),
    settings: z.record(z.string(), pluginSettingFieldSchema).openapi({
      description: "The workspace settings the plugin declares.",
    }),
    web: z
      .object({
        entry: z.string(),
        styles: z.string().nullable(),
      })
      .nullable()
      .openapi({
        description:
          "Web bundle paths, relative to the API base URL. Null when the plugin has no web entry.",
      }),
    workspace: workspacePluginStateSchema.nullable().openapi({
      description: "Workspace state. Null unless workspaceId was given.",
    }),
  })
  .openapi("Plugin");

export const pluginListSchema = z
  .object({ plugins: z.array(pluginSchema) })
  .openapi("PluginList");

export const pluginSettingsErrorSchema = z
  .object({
    message: z.string(),
    errors: z.record(z.string(), z.string()).openapi({
      description: "Error message per settings field.",
    }),
  })
  .openapi("PluginSettingsError");

export const pluginDataPurgeSchema = z
  .object({
    storage: z.number().int().openapi({
      description: "Rows deleted from the plugin's stored data.",
    }),
    workspaces: z.number().int().openapi({
      description:
        "Rows deleted from the plugin's per-workspace state and settings.",
    }),
  })
  .openapi("PluginDataPurge");
