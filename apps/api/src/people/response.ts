import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const personSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string(),
    title: z.string().nullable(),
    departmentId: z.string().nullable(),
    departmentName: z.string().nullable(),
    joinDate: z.string().nullable(),
    status: z.string(),
    clockedIn: z.boolean().openapi({
      description: "Has an open attendance session right now.",
    }),
    online: z.boolean().openapi({
      description:
        "A paired desktop app reported in during the last two minutes. Presence only, not work time.",
    }),
  })
  .openapi("Person");

export const personListSchema = z.array(personSchema);

export const scheduleSchema = z
  .object({
    workDays: z.array(z.number()),
    workStart: z.string(),
    workEnd: z.string(),
    breakMinutes: z.number(),
  })
  .openapi("WorkSchedule");

export const personDetailSchema = personSchema
  .extend({
    schedule: scheduleSchema.openapi({
      description:
        "The schedule that applies: company defaults plus overrides.",
    }),
    overrides: z
      .object({
        workDays: z.array(z.number()).nullable(),
        workStart: z.string().nullable(),
        workEnd: z.string().nullable(),
        breakMinutes: z.number().nullable(),
      })
      .openapi({ description: "Only the fields set for this person." }),
  })
  .openapi("PersonDetail");

export const personTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    number: z.number().nullable(),
    status: z.string(),
    statusName: z.string().nullable(),
    statusIcon: z.string().nullable(),
    priority: z.string(),
    dueDate: nullableResponseTimestamp,
    estimateMinutes: z.number().nullable(),
    trackedSeconds: z.number(),
    done: z.boolean(),
    assignedById: z.string().nullable().openapi({
      description:
        "Who last assigned the task to this person (the creator when assigned at creation).",
    }),
    assignedByName: z.string().nullable(),
    assignedByImage: z.string().nullable(),
    attachmentCount: z.number(),
    subtaskTotal: z.number(),
    subtaskDone: z.number().openapi({
      description: "Subtasks in a final column.",
    }),
    createdAt: responseTimestamp,
    myPosition: z.number().nullable().openapi({
      description:
        "The person's own My work order (lower first); null until they arrange it.",
    }),
    projectId: z.string(),
    projectName: z.string(),
    projectSlug: z.string(),
  })
  .openapi("PersonTask");

export const personTaskListSchema = z.array(personTaskSchema);

export const peopleOverviewSchema = z
  .object({
    today: z.string().openapi({ description: "Company-local day" }),
    currency: z.string(),
    leaveAllowance: z
      .number()
      .openapi({ description: "Annual leave days per person" }),
    unassignedOpenTasks: z.number(),
    people: z.array(
      z.object({
        userId: z.string(),
        openTasks: z.number(),
        overdueTasks: z.number(),
        workedMinutesThisMonth: z.number(),
        leaveUsed: z.number(),
        leavePending: z.number(),
        onLeaveToday: z.boolean(),
      }),
    ),
  })
  .openapi("PeopleOverview");
