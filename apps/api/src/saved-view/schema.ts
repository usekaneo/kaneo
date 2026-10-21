import { z } from "../openapi";

const values = z.array(z.string().max(256)).max(100).nullable().default(null);
export const projectViewConfigSchema = z
  .object({
    version: z.literal(1),
    search: z.string().max(1000),
    filters: z
      .object({
        status: values,
        priority: values,
        assignee: values,
        dueDate: values,
        createdDate: values,
        labels: values,
        negated: values,
        customFields: z
          .record(z.string().max(128), z.array(z.string().max(1000)).max(100))
          .refine((value) => Object.keys(value).length <= 100)
          .nullable()
          .default(null),
      })
      .strict(),
    sort: z
      .object({
        field: z.enum([
          "position",
          "createdAt",
          "priority",
          "dueDate",
          "title",
          "number",
        ]),
        direction: z.enum(["asc", "desc"]),
      })
      .strict(),
    layout: z.enum(["board", "list"]),
  })
  .strict();
export const savedViewBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    config: projectViewConfigSchema,
  })
  .strict();
export const savedViewProjectParam = z.object({ projectId: z.string().min(1) });
export const savedViewParam = savedViewProjectParam.extend({
  id: z.string().min(1),
});
export const savedViewSchema = savedViewBody
  .extend({ id: z.string(), projectId: z.string() })
  .openapi("PersonalProjectView");
export type ProjectViewConfig = z.infer<typeof projectViewConfigSchema>;
