import {
  apiRouter,
  createRoute,
  jsonResponse,
  pagingNumber,
  responseTimestamp,
  z,
} from "../../../openapi";
import { boundedRequestBody } from "../../../utils/bounded-request-body";
import { requireWorkspacePermission } from "../../../utils/require-workspace-permission";
import { middleware, mutationMiddleware, errors } from "../../routes/common";
import { codeActionSchema, workspaceParams } from "../../schema";
import { startCodeJob } from "../create-job";
import { jobResponse } from "../job-response";
import { cancelCodeJob, getCodeJob, getJobEvents } from "../read-jobs";
import { codeJobsEnabled } from "../config";
import { listCodeRepositories } from "../list-repositories";

const jobParams = workspaceParams.extend({ jobId: z.string().min(1).max(128) });
const repositoryResponse = z.object({
  integrationId: z.string(),
  projectId: z.string(),
  host: z.literal("github"),
  fullName: z.string(),
  defaultBranch: z.string().nullable(),
  backend: z.literal("repo-ci"),
  state: z.enum(["ready", "unavailable"]),
});
const jobs = apiRouter()
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/code/status",
      operationId: "getAgentCodeStatus",
      tags: ["Agent"],
      summary: "Read coding-agent configuration and permission availability",
      middleware,
      request: { params: workspaceParams },
      responses: {
        200: jsonResponse(
          "Coding availability",
          z.object({ enabled: z.boolean(), canRunCode: z.boolean() }),
        ),
        ...errors,
      },
    }),
    async (c) => {
      const { hasUserWorkspacePermission } =
        await import("../../../utils/require-workspace-permission");
      return c.json(
        {
          enabled: codeJobsEnabled(),
          canRunCode:
            codeJobsEnabled() &&
            (await hasUserWorkspacePermission(
              c.get("userId"),
              c.req.valid("param").workspaceId,
              { agent: ["run_code"] },
            )),
        },
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/code/repositories",
      operationId: "listAgentCodeRepositories",
      tags: ["Agent"],
      summary:
        "List opted-in project repositories available to your linked GitHub account",
      middleware,
      request: { params: workspaceParams },
      responses: {
        200: jsonResponse("Coding repositories", z.array(repositoryResponse)),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await listCodeRepositories({
          userId: c.get("userId"),
          workspaceId: c.req.valid("param").workspaceId,
          projectId: null,
        }),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/jobs",
      operationId: "startAgentCodeJob",
      tags: ["Agent"],
      summary:
        "Start a coding job directly from a task with an applied proposal audit record",
      middleware: [
        ...mutationMiddleware,
        requireWorkspacePermission({ agent: ["run_code"] }),
        boundedRequestBody(16384),
      ],
      request: {
        params: workspaceParams,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: codeActionSchema
                .omit({ type: true })
                .extend({ requestId: z.string().uuid() }),
            },
          },
        },
      },
      responses: {
        202: jsonResponse("Queued or existing coding job", jobResponse),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await startCodeJob(
          {
            userId: c.get("userId"),
            workspaceId: c.req.valid("param").workspaceId,
            projectId: null,
          },
          c.req.valid("json"),
        ),
        202,
      ),
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/jobs/{jobId}",
      operationId: "getAgentCodeJob",
      tags: ["Agent"],
      summary: "Read a coding job under its conversation sharing rules",
      middleware,
      request: { params: jobParams },
      responses: { 200: jsonResponse("Coding job", jobResponse), ...errors },
    }),
    async (c) => {
      const { workspaceId, jobId } = c.req.valid("param");
      return c.json(
        await getCodeJob(
          { userId: c.get("userId"), workspaceId, projectId: null },
          jobId,
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/jobs/{jobId}/events",
      operationId: "getAgentCodeJobEvents",
      tags: ["Agent"],
      summary: "Read bounded coding job state events",
      middleware,
      request: {
        params: jobParams,
        query: z.object({ after: pagingNumber(0, 2147483647, 0) }),
      },
      responses: {
        200: jsonResponse(
          "Job state events",
          z.array(
            z.object({
              sequence: z.number(),
              jobId: z.string(),
              phase: z.string(),
              createdAt: responseTimestamp,
            }),
          ),
        ),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, jobId } = c.req.valid("param");
      return c.json(
        await getJobEvents(
          { userId: c.get("userId"), workspaceId, projectId: null },
          jobId,
          c.req.valid("query").after,
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/jobs/{jobId}/cancel",
      operationId: "cancelAgentCodeJob",
      tags: ["Agent"],
      summary:
        "Cancel your job before PR creation starts and revoke its credential",
      middleware,
      request: { params: jobParams },
      responses: {
        200: jsonResponse("Current coding job", jobResponse),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, jobId } = c.req.valid("param");
      return c.json(
        await cancelCodeJob(
          { userId: c.get("userId"), workspaceId, projectId: null },
          jobId,
        ),
        200,
      );
    },
  );
export default jobs;
