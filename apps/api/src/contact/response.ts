import { responseTimestamp, z } from "../openapi";

export const contactSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    type: z.string(),
    region: z.string(),
    notes: z.string().nullable(),
    leadCount: z.number().int().optional().openapi({
      description: "Number of tasks (leads) linked to this contact.",
    }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("Contact");

export const contactListSchema = z.array(contactSchema);
