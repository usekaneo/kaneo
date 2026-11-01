import { pagingNumber, z } from "../../openapi";
import { AGENT_MENTION_LIMIT, parseMentionRefs } from "../mention-token";
import { workspaceParams } from "../schema";
import {
  AUTOMATION_DEFAULT_DAILY_RUNS,
  AUTOMATION_MAX_DAILY_RUNS,
} from "./limits";
import { AUTOMATION_EVENTS, AUTOMATION_OUTPUTS } from "./types";

const id = z.string().trim().min(1).max(128);

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const automationScheduleSchema = z
  .object({
    type: z.literal("schedule"),
    frequency: z.enum(["daily", "weekly", "interval"]),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
      .default("09:00")
      .openapi({ description: "Local time HH:MM in `timezone`" }),
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .max(7)
      .default([])
      .openapi({
        description:
          "ISO weekdays (1 = Monday … 7 = Sunday); required for weekly schedules",
      }),
    intervalHours: z
      .number()
      .int()
      .min(1)
      .max(24)
      .nullable()
      .default(null)
      .openapi({ description: "Hours between runs; required for intervals" }),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(isTimeZone, "Unknown time zone")
      .default("UTC")
      .openapi({ description: "IANA time zone, e.g. Europe/Berlin" }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.frequency === "weekly" && value.weekdays.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Pick at least one weekday",
      });
    if (value.frequency === "interval" && value.intervalHours === null)
      ctx.addIssue({
        code: "custom",
        path: ["intervalHours"],
        message: "Interval schedules need intervalHours",
      });
  });

const filterName = z.string().trim().min(1).max(100).nullable().default(null);
export const automationEventTriggerSchema = z
  .object({
    type: z.literal("event"),
    event: z.enum(AUTOMATION_EVENTS),
    filters: z
      .object({
        labelName: filterName.openapi({
          description: "Only tasks with a label of this name",
        }),
        columnName: filterName.openapi({
          description:
            "Only tasks in a column of this name (the target column for task_moved)",
        }),
        projectId: id.nullable().default(null).openapi({
          description:
            "Only tasks in this project; ignored when the automation is scoped to a project",
        }),
      })
      .strict()
      .default({ labelName: null, columnName: null, projectId: null }),
  })
  .strict();

export const automationTriggerSchema = z.discriminatedUnion("type", [
  automationScheduleSchema,
  automationEventTriggerSchema,
]);

export const automationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    prompt: z
      .string()
      .trim()
      .min(1)
      .max(16000)
      .refine(
        (prompt) => parseMentionRefs(prompt).length <= AGENT_MENTION_LIMIT,
        `Mention at most ${AGENT_MENTION_LIMIT} tasks or projects`,
      )
      .openapi({
        description:
          "Instructions for each run. May contain `@[label](task:ID)` or `@[label](project:ID)` mentions, resolved with the owner's access when the run starts.",
      }),
    projectId: id.nullable().default(null).openapi({
      description: "Scope runs to one project; null for the whole workspace",
    }),
    output: z.enum(AUTOMATION_OUTPUTS).openapi({
      description:
        "`proposals`: changes wait for the owner's review. `digest`: read-only run whose response is sent to the owner's inbox.",
    }),
    model: z.string().trim().min(1).max(200).optional().openapi({
      description:
        "Model from the config endpoint's models; omit for the instance default",
    }),
    trigger: automationTriggerSchema,
    dailyRunLimit: z
      .number()
      .int()
      .min(1)
      .max(AUTOMATION_MAX_DAILY_RUNS)
      .default(AUTOMATION_DEFAULT_DAILY_RUNS)
      .openapi({ description: "Runs allowed in any 24 hours" }),
  })
  .strict();

export const createAutomationSchema = automationBodySchema.extend({
  enabled: z.boolean().default(true),
});

export const automationParams = workspaceParams.extend({ automationId: id });

export const listAutomationsQuery = z.object({
  kind: z.enum(["all", "agent", "rules"]).default("all").openapi({
    description:
      "`agent` for agent automations, `rules` for project workflow rules",
  }),
  projectId: id.optional(),
  ownerId: id.optional().openapi({
    description: "Agent automations owned by this user; excludes rules",
  }),
  limit: pagingNumber(1, 50, 20),
  offset: pagingNumber(0, 10000, 0),
});

export const listAutomationRunsQuery = z.object({
  limit: pagingNumber(1, 50, 20),
  offset: pagingNumber(0, 10000, 0),
});
