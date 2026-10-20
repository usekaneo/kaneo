import { IMPORT_SOURCE_IDS } from "@kaneo/importers";
import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import {
  IMPORT_RUN_PROJECT_STATUSES,
  IMPORT_RUN_STATUSES,
} from "./import-run-project";

export const importSourceProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    detail: z.string().optional().openapi({
      description:
        "Extra context shown next to the name, such as the source workspace or team.",
    }),
  })
  .openapi("ImportSourceProject");

export const importSourceProjectListSchema = z
  .object({ projects: z.array(importSourceProjectSchema) })
  .openapi("ImportSourceProjectList");

const importCountsSchema = z
  .object({
    columns: z.number().int(),
    tasks: z.number().int(),
    labels: z.number().int(),
    comments: z.number().int(),
    assignees: z.number().int().openapi({
      description: "Tasks that were assigned to a workspace member.",
    }),
    relations: z.number().int(),
  })
  .openapi("ImportCounts");

export const importRunProjectSchema = z
  .object({
    sourceId: z.string(),
    name: z.string(),
    status: z.enum(IMPORT_RUN_PROJECT_STATUSES),
    projectId: z.string().nullable().openapi({
      description: "The Kaneo project created by the import, once completed.",
    }),
    projectSlug: z.string().nullable(),
    counts: importCountsSchema,
    warnings: z.array(z.string()),
    error: z.string().nullable(),
  })
  .openapi("ImportRunProject");

export const importRunSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    source: z.enum(IMPORT_SOURCE_IDS),
    status: z.enum(IMPORT_RUN_STATUSES).openapi({
      description:
        "completed once every selected project was attempted, even if some failed; check each project's status. failed means the run itself stopped.",
    }),
    includeComments: z.boolean(),
    message: z.string().nullable().openapi({
      description: "Latest progress line while the run is running.",
    }),
    error: z.string().nullable(),
    projects: z.array(importRunProjectSchema),
    createdAt: responseTimestamp,
    finishedAt: nullableResponseTimestamp,
  })
  .openapi("ImportRun");

export const importRunEnvelopeSchema = z
  .object({ run: importRunSchema })
  .openapi("ImportRunEnvelope");

export const importRunListSchema = z
  .object({ runs: z.array(importRunSchema) })
  .openapi("ImportRunList");

export const trelloAuthorizeUrlSchema = z
  .object({
    authorizeUrl: z.string().nullable().openapi({
      description:
        "Trello page where the user approves read access for Kaneo and copies a token. null when the server has no TRELLO_API_KEY; the user then sends their own Trello API key with the token.",
    }),
  })
  .openapi("TrelloAuthorizeUrl");

export type ImportRunResponse = z.infer<typeof importRunSchema>;
