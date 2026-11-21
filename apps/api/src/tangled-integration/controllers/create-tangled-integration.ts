import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { tangledConfigSchema } from "../../plugins/tangled/config";
import type { TangledProjectConnectionBody } from "../schema";
import { getTangledIntegration } from "./project-connection";
import { verifyTangledRepository } from "./verify-tangled-repository";

type Body = TangledProjectConnectionBody;

export default async function createTangledIntegration({
  projectId,
  body,
}: {
  projectId: string;
  body: Body;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const existing = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "tangled"),
    ),
  });
  if (existing)
    throw new HTTPException(409, {
      message: "Tangled integration already exists",
    });

  const config = {
    origin: body.baseUrl,
    repositoryDid: body.repositoryDid,
    repositoryFullName: body.repositoryId,
    repositoryUrl: body.repositoryUrl,
    branchPattern: body.branchPattern,
    webhookSecret: body.webhookSecret,
    active: body.isActive,
  };
  const parsed = v.safeParse(tangledConfigSchema, config);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: "Invalid Tangled integration configuration",
    });
  }

  if (parsed.output.active) await verifyTangledRepository(parsed.output);

  const [inserted] = await db
    .insert(integrationTable)
    .values({
      projectId,
      type: "tangled",
      config: JSON.stringify(parsed.output),
      isActive: body.isActive,
    })
    .onConflictDoNothing({
      target: [integrationTable.projectId, integrationTable.type],
    })
    .returning({ id: integrationTable.id });
  if (!inserted) {
    throw new HTTPException(409, {
      message: "Tangled integration already exists",
    });
  }

  const result = await getTangledIntegration(projectId);
  if (!result)
    throw new HTTPException(500, {
      message: "Failed to load Tangled integration",
    });
  return result;
}
