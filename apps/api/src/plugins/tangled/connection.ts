import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import { activeIntegrationCondition } from "../active-integration-condition";
import { tangledConfigSchema, type TangledConfig } from "./config";

export type TangledConnection = {
  id: string;
  projectId: string;
  config: string;
  parsed: TangledConfig;
};
export type TangledTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export async function loadTangledConnection(
  id: string,
): Promise<TangledConnection> {
  const row = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.id, id),
      eq(integrationTable.type, "tangled"),
      activeIntegrationCondition(),
    ),
  });
  if (!row)
    throw new HTTPException(404, {
      message: "Active Tangled connection not found",
    });
  let config: unknown;
  try {
    config = JSON.parse(row.config);
  } catch {
    throw new HTTPException(500, {
      message: "Tangled connection configuration is invalid",
    });
  }
  const parsed = v.safeParse(tangledConfigSchema, config);
  if (!parsed.success)
    throw new HTTPException(500, {
      message: "Tangled connection configuration is invalid",
    });
  if (!parsed.output.active)
    throw new HTTPException(404, {
      message: "Active Tangled connection not found",
    });
  return {
    id: row.id,
    projectId: row.projectId,
    config: row.config,
    parsed: parsed.output,
  };
}

export async function withTangledConnection<T>(
  connection: TangledConnection,
  ref: string | null,
  apply: (transaction: TangledTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '2s'`);
    await tx.execute(sql`set local statement_timeout = '25s'`);
    if (ref !== null) {
      const key = JSON.stringify([
        connection.id,
        connection.parsed.repositoryDid,
        ref,
      ]);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
      );
    }
    const [current] = await tx
      .select({ id: integrationTable.id })
      .from(integrationTable)
      .where(
        and(
          eq(integrationTable.id, connection.id),
          eq(integrationTable.projectId, connection.projectId),
          eq(integrationTable.type, "tangled"),
          eq(integrationTable.config, connection.config),
          activeIntegrationCondition(),
        ),
      )
      .for("share");
    if (!current)
      throw new HTTPException(409, {
        message: "Tangled connection changed; retry with its current settings",
      });
    return apply(tx);
  });
}
