import { z } from "../openapi";

export const projectIdParam = z.object({
  projectId: z.string(),
});

export const taskIdParam = z.object({
  taskId: z.string(),
});

export const customFieldIdParam = z.object({
  id: z.string(),
});

const customFieldType = z.enum([
  "text",
  "number",
  "date",
  "dropdown",
  "boolean",
  "multiselect",
]);

export const createCustomFieldBody = z.object({
  projectId: z.string(),
  name: z.string(),
  type: customFieldType,
  required: z.boolean().optional().default(false),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const updateCustomFieldBody = z.object({
  name: z.string().optional().openapi({
    description: "New name for the field. Cannot be blank.",
  }),
  type: customFieldType.optional().openapi({
    description:
      "Only `dropdown` and `multiselect` can switch between each other. Task values are converted, and switching to `dropdown` is rejected while a task has more than one option picked. Any other type change is rejected.",
  }),
  required: z.boolean().optional().openapi({
    description:
      "Whether every task must have a value. Turning it on needs a default, which fills tasks that have no value yet.",
  }),
  defaultValue: z.string().nullable().optional().openapi({
    description:
      "Value new tasks start with. Send `null` or an empty string to clear it. Multiselect defaults are a JSON array of options.",
  }),
  options: z.array(z.string()).optional().openapi({
    description:
      "The full option list for dropdown and multiselect fields, in display order. Adding and reordering options is always allowed. Removing or renaming an option that a task still uses is rejected with 400, so task values are never changed silently.",
  }),
});

export const reorderCustomFieldsBody = z.object({
  fields: z.array(
    z.object({
      id: z.string(),
      position: z.number(),
    }),
  ),
});

export const setCustomFieldValueBody = z.object({
  taskId: z.string(),
  fieldId: z.string(),
  value: z.string(),
});
