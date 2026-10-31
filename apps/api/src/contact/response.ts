import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

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

export const contactTimelineSchema = z
  .object({
    leads: z.array(
      z.object({
        id: z.string(),
        number: z.number().nullable(),
        title: z.string(),
        status: z.string(),
        dueDate: nullableResponseTimestamp.openapi({
          description: "The next follow-up for this lead, if scheduled.",
        }),
        projectId: z.string(),
        projectName: z.string(),
      }),
    ),
    entries: z
      .array(
        z.object({
          id: z.string(),
          taskId: z.string(),
          taskNumber: z.number().nullable(),
          taskTitle: z.string(),
          projectId: z.string(),
          content: z.string(),
          createdAt: responseTimestamp,
          user: z.object({
            name: z.string(),
            image: z.string().nullable(),
          }),
        }),
      )
      .openapi({
        description:
          "Comments on the contact's leads, newest first. Each comment is one logged interaction.",
      }),
  })
  .openapi("ContactTimeline");
