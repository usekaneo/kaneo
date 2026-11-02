import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  integrationTable,
  tangledIntegrationStateTable,
} from "../../database/schema";

export async function getTangledOutcome(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "tangled"),
    ),
  });
  if (!integration)
    throw new HTTPException(404, { message: "Tangled connection not found" });
  const state = await db.query.tangledIntegrationStateTable.findFirst({
    where: eq(tangledIntegrationStateTable.integrationId, integration.id),
  });
  if (!state?.checkedAt || !state.eventType || !state.outcome || !state.code)
    return null;
  return {
    eventType: state.eventType,
    outcome: state.outcome,
    code: state.code,
    ref: state.ref,
    checkedAt: state.checkedAt.toISOString(),
  };
}
