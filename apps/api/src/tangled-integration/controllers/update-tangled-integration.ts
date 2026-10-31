import * as v from "valibot";
import { and, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  tangledConfigSchema,
  type TangledConfig,
} from "../../plugins/tangled/config";
import type { UpdateTangledProjectConnectionBody } from "../schema";
import { getTangledIntegration } from "./project-connection";
import { verifyTangledRepository } from "./verify-tangled-repository";

export default async function updateTangledIntegration({
  projectId,
  body,
}: {
  projectId: string;
  body: UpdateTangledProjectConnectionBody;
}) {
  const row = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "tangled"),
    ),
  });
  if (!row)
    throw new HTTPException(404, { message: "Tangled integration not found" });

  let stored: TangledConfig;
  try {
    stored = JSON.parse(row.config) as TangledConfig;
  } catch {
    throw new HTTPException(500, {
      message: "Invalid Tangled integration config",
    });
  }

  const config = {
    origin: body.baseUrl ?? stored.origin,
    repositoryDid: body.repositoryDid ?? stored.repositoryDid,
    repositoryFullName: body.repositoryId ?? stored.repositoryFullName,
    repositoryUrl: body.repositoryUrl ?? stored.repositoryUrl,
    branchPattern: body.branchPattern ?? stored.branchPattern,
    webhookSecret: body.webhookSecret ?? stored.webhookSecret,
    active: body.isActive ?? row.isActive ?? stored.active,
  };
  const parsed = v.safeParse(tangledConfigSchema, config);
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: "Invalid Tangled integration configuration",
    });
  }

  if (parsed.output.active) await verifyTangledRepository(parsed.output);

  const [saved] = await db
    .update(integrationTable)
    .set({
      config: JSON.stringify(parsed.output),
      isActive: body.isActive ?? row.isActive ?? true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrationTable.id, row.id),
        eq(integrationTable.config, row.config),
        row.isActive === null
          ? isNull(integrationTable.isActive)
          : eq(integrationTable.isActive, row.isActive),
      ),
    )
    .returning({ id: integrationTable.id });
  if (!saved)
    throw new HTTPException(409, {
      message: "Integration changed; refresh before updating",
    });

  const result = await getTangledIntegration(projectId);
  if (!result)
    throw new HTTPException(500, {
      message: "Failed to load Tangled integration",
    });
  return result;
}
