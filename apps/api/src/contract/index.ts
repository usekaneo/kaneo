import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  getContractSubmissionForTask,
  listContractTemplates,
  sendContract,
} from "./controllers/contract-actions";

const templateSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  originalFilename: v.string(),
  storageKey: v.string(),
  mimeType: v.string(),
  sizeBytes: v.number(),
  fieldMap: v.array(v.record(v.string(), v.unknown())),
  bodyHtml: v.nullable(v.string()),
  previewHtml: v.nullable(v.string()),
  createdBy: v.nullable(v.string()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

const submissionSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  projectId: v.string(),
  taskId: v.string(),
  clientId: v.string(),
  templateId: v.string(),
  docusealSubmissionId: v.string(),
  status: v.string(),
  submitters: v.array(v.record(v.string(), v.unknown())),
  signedPdfAssetId: v.nullable(v.string()),
  createdBy: v.nullable(v.string()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

const contract = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/templates",
    describeRoute({
      operationId: "listContractTemplates",
      tags: ["Contracts"],
      description: "List contract templates for a workspace",
      responses: {
        200: {
          description: "Contract templates",
          content: {
            "application/json": {
              schema: resolver(v.array(templateSchema)),
            },
          },
        },
      },
    }),
    validator("query", v.object({ workspaceId: v.string() })),
    workspaceAccess.fromQuery(),
    async (c) => {
      const workspaceId = c.get("workspaceId");
      const templates = await listContractTemplates(workspaceId);
      return c.json(templates);
    },
  )
  .get(
    "/submission/:taskId",
    describeRoute({
      operationId: "getContractSubmission",
      tags: ["Contracts"],
      description: "Get contract submission for a task",
      responses: {
        200: {
          description: "Contract submission or null",
          content: {
            "application/json": {
              schema: resolver(v.nullable(submissionSchema)),
            },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId("taskId"),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const submission = await getContractSubmissionForTask(taskId);
      return c.json(submission);
    },
  )
  .post(
    "/send",
    describeRoute({
      operationId: "sendContract",
      tags: ["Contracts"],
      description: "Create a contract submission for a task",
      responses: {
        200: {
          description: "Contract submission created",
          content: {
            "application/json": { schema: resolver(submissionSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        workspaceId: v.string(),
        taskId: v.string(),
        templateId: v.string(),
        clientId: v.string(),
      }),
    ),
    workspaceAccess.fromBody(),
    async (c) => {
      const { taskId, templateId, clientId } = c.req.valid("json");
      const workspaceId = c.get("workspaceId");
      const userId = c.get("userId");

      const submission = await sendContract({
        workspaceId,
        taskId,
        templateId,
        clientId,
        createdBy: userId,
      });

      return c.json(submission);
    },
  );

export default contract;
