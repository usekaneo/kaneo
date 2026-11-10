import { lockStorageObjects } from "../../storage/cleanup-queue";
import { verifyPrivateObjectExists } from "../../storage/s3";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database, QuillsActor } from "../../database/quills/client";
import { principal } from "../../database/quills/schema/auth";
import { importRuns } from "../../database/quills/schema/import-runs";
import { initializeQuillsWorkspace } from "../../database/quills/initialize-workspace";
import { settleExternalSideEffects } from "../../database/quills/settle-external-side-effects";
import { recordQuillsChange } from "../events";
import {
  collectStorageKeys,
  storageValues,
  archiveSchema,
  MAX_ARCHIVE_BYTES,
  portableTables,
  quote,
  type WorkspaceArchive,
} from "./archive";

export const mappingSchema = z
  .object({
    actors: z.record(z.string(), z.string().min(1)).default({}),
    projects: z.record(z.string(), z.string().min(1)).default({}),
    tasks: z.record(z.string(), z.string().min(1)).default({}),
    teams: z.record(z.string(), z.string().min(1)).default({}),
    storage: z.record(z.string(), z.string().min(1)).default({}),
  })
  .strict();
export type CanonicalMember = {
  id: string;
  name: string;
  image: string | null;
};
const seedTables = new Set([
  "settings",
  "principal",
  "roles",
  "permissions",
  "role_permissions",
  "principal_role_assignments",
  "post_statuses",
  "ticket_statuses",
]);
export function prepareArchive(
  input: unknown,
  mappingInput: unknown,
  workspaceId: string,
  members: CanonicalMember[],
) {
  if (Buffer.byteLength(JSON.stringify(input)) > MAX_ARCHIVE_BYTES)
    throw new Error("Workspace archive exceeds 64 MiB");
  const archive = archiveSchema.parse(input),
    mapping = mappingSchema.parse(mappingInput);
  const actorByCustomer = new Map(
    (archive.tables.principal ?? [])
      .filter((p) => p.user_id)
      .map((p) => [p.user_id, p.id]),
  );
  const byName = new Map(portableTables.map((t) => [t.config.name, t]));
  for (const [name, rows] of Object.entries(archive.tables)) {
    const target = byName.get(name);
    if (!target) throw new Error(`Unsupported archive table: ${name}`);
    const columns = new Set(target.config.columns.map((c) => c.name));
    for (const row of rows) {
      for (const column of Object.keys(row))
        if (!columns.has(column))
          throw new Error(`Unknown archive column: ${name}.${column}`);
      row.workspace_id = workspaceId;
      if (
        (name === "tickets" && row.number !== undefined) ||
        (["kb_articles", "kb_categories"].includes(name) &&
          row.url_id !== undefined)
      ) {
        const value = String(name === "tickets" ? row.number : row.url_id);
        const maximum =
          name === "tickets" ? BigInt(Number.MAX_SAFE_INTEGER) : 2147483647n;
        if (
          !/^\d+$/.test(value) ||
          BigInt(value) >= maximum ||
          BigInt(value) < 1n
        )
          throw new Error("Unsupported public number in archive");
      }

      if (
        name === "integration_sync_operations" &&
        ["queued", "running", "retry_wait"].includes(String(row.state))
      ) {
        row.state = row.dispatched_at ? "uncertain" : "cancelled";
        row.cancel_requested = true;
        row.lease_token = null;
        row.lease_expires_at = null;
        row.finished_at = new Date().toISOString();
      }
      if (
        name === "workflow_runs" &&
        ["running", "waiting"].includes(String(row.state))
      ) {
        row.state = "interrupted";
        row.ended_at = new Date().toISOString();
      }
      if (
        name === "assistant_pending_actions" &&
        ["proposed", "approved"].includes(String(row.status))
      )
        row.status = "expired";

      if (name === "audit_log" && !row.actor_principal_id && row.actor_user_id)
        row.actor_principal_id = actorByCustomer.get(row.actor_user_id) ?? null;
      if (name === "customer_identity") row.kaneo_user_id = null;
      if (name === "settings") {
        row.catalogue_version = 0;
        row.auth_config = null;
      }
      if (
        name === "principal" &&
        (row.kaneo_user_id ||
          row.role === "admin" ||
          row.role === "member" ||
          row.type === "support" ||
          mapping.actors[String(row.id)])
      ) {
        const userId = mapping.actors[String(row.id)] ?? row.kaneo_user_id;
        const user = members.find((m) => m.id === userId);
        if (!user)
          throw new Error(
            `Explicit mapping to a current workspace member required for actor ${String(row.id)}`,
          );
        row.kaneo_user_id = user.id;
        row.user_id = null;
        row.role = "user";
        row.type = "user";
        row.display_name = user.name;
        row.avatar_url = user.image;
        row.avatar_key = null;
      }
      if (name === "board_projects")
        row.project_id = requiredMapping(
          mapping.projects,
          String(row.project_id),
          "project",
        );
      if (name === "post_tasks")
        row.task_id = requiredMapping(
          mapping.tasks,
          String(row.task_id),
          "task",
        );
      if (name === "teams" && row.kaneo_team_id)
        row.kaneo_team_id = requiredMapping(
          mapping.teams,
          String(row.kaneo_team_id),
          "team",
        );
    }
  }
  const boundTeams = new Set(
    (archive.tables.teams ?? [])
      .filter((t) => t.kaneo_team_id)
      .map((t) => t.id),
  );
  if (archive.tables.team_members)
    archive.tables.team_members = archive.tables.team_members.filter(
      (m) => !boundTeams.has(m.team_id),
    );
  const staff = new Set(
    (archive.tables.principal ?? [])
      .filter((p) => p.kaneo_user_id)
      .map((p) => p.id),
  );
  if (archive.tables.principal_role_assignments)
    archive.tables.principal_role_assignments =
      archive.tables.principal_role_assignments.filter(
        (r) => !staff.has(r.principal_id),
      );
  for (const [name, rows] of Object.entries(archive.tables))
    for (const row of rows)
      for (const { object, field } of storageValues(row, name))
        if (typeof object[field] === "string")
          object[field] = Object.hasOwn(mapping.storage, object[field])
            ? mapping.storage[object[field]]
            : object[field];
  archive.storageKeys = collectStorageKeys(archive.tables);
  return archive;
}
function requiredMapping(
  mapping: Record<string, string>,
  key: string,
  kind: string,
) {
  const target = Object.hasOwn(mapping, key) ? mapping[key] : undefined;
  if (!target) throw new Error(`Explicit ${kind} mapping required for ${key}`);
  return target;
}
export async function importWorkspaceArchive(
  db: Database,
  actor: QuillsActor,
  archive: WorkspaceArchive,
  members: CanonicalMember[],
  workspace: { name: string; slug: string },
  dryRun = false,
) {
  for (const { config } of portableTables) {
    if (seedTables.has(config.name)) continue;
    if (
      (
        await db.execute(
          sql.raw(`SELECT 1 FROM quills.${quote(config.name)} LIMIT 1`),
        )
      ).rows.length
    )
      throw new Error(`Target workspace must be empty: ${config.name}`);
  }
  if (
    (
      await db
        .select()
        .from(principal)
        .where(sql`${principal.kaneoUserId} IS NULL`)
    ).length
  )
    throw new Error("Target workspace already has customer or service actors");
  const days = [
    ...new Set(
      (archive.tables.page_views ?? []).map((row) => {
        const date =
          typeof row.occurred_at === "string"
            ? new Date(row.occurred_at)
            : new Date(Number.NaN);
        if (!Number.isFinite(date.getTime()))
          throw new Error("Invalid page view timestamp in archive");
        return date.toISOString().slice(0, 10);
      }),
    ),
  ];
  if (days.length)
    await db.execute(
      sql`SELECT quills.prepare_import_partitions(ARRAY[${sql.join(
        days.map((day) => sql`${day}`),
        sql`, `,
      )}]::date[])`,
    );
  await lockStorageObjects(db, archive.storageKeys);
  for (const key of archive.storageKeys) await verifyPrivateObjectExists(key);
  await db.execute(sql`SET CONSTRAINTS ALL DEFERRED`);
  for (const name of [
    "principal_role_assignments",
    "role_permissions",
    "roles",
    "permissions",
    "post_statuses",
    "ticket_statuses",
    "settings",
    "principal",
  ])
    await db.execute(sql.raw(`DELETE FROM quills.${quote(name)}`));
  const ordered = [...portableTables].sort(
    (a, b) =>
      ({ principal: -2, teams: -1 }[a.config.name as "principal" | "teams"] ??
        0) -
      ({ principal: -2, teams: -1 }[b.config.name as "principal" | "teams"] ??
        0),
  );
  let count = 0;
  for (const { config } of ordered) {
    const rows = archive.tables[config.name] ?? [];
    if (!rows.length) continue;
    // Group by supplied columns so omitted legacy fields receive database defaults.
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const columns = config.columns
        .filter(
          (c) =>
            c.generatedIdentity?.type !== "always" &&
            !c.generated &&
            Object.hasOwn(row, c.name),
        )
        .map((c) => c.name);
      const key = columns.map(quote).join(",");
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    for (const [columnList, group] of groups)
      for (let offset = 0; offset < group.length; offset += 250) {
        const batch = group.slice(offset, offset + 250);
        await db.execute(
          sql`INSERT INTO ${sql.raw(`quills.${quote(config.name)}`)} (${sql.raw(columnList)}) SELECT ${sql.raw(columnList)} FROM jsonb_populate_recordset(NULL::${sql.raw(`quills.${quote(config.name)}`)},${JSON.stringify(batch)}::jsonb)`,
        );
        count += batch.length;
      }
  }
  for (const member of members) {
    const [exists] = await db
      .select({ id: principal.id })
      .from(principal)
      .where(eq(principal.kaneoUserId, member.id));
    if (!exists)
      await db.insert(principal).values({
        kaneoUserId: member.id,
        displayName: member.name,
        avatarUrl: member.image,
        role: "user",
        type: "user",
        createdAt: new Date(),
      });
  }
  await db.execute(
    sql`UPDATE quills.teams SET kaneo_team_id=kaneo_team_id WHERE kaneo_team_id IS NOT NULL`,
  );
  await initializeQuillsWorkspace(db, {
    workspaceId: actor.workspaceId,
    ...workspace,
  });
  await settleExternalSideEffects(db, { restoredTo: new Date() });
  if (
    archive.tables.tickets?.length ||
    archive.tables.kb_articles?.length ||
    archive.tables.kb_categories?.length
  )
    await db.execute(sql`SELECT quills.advance_imported_sequences()`);
  await db.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
  const [currentActor] = await db
    .select({ id: principal.id })
    .from(principal)
    .where(eq(principal.kaneoUserId, actor.userId));
  if (!currentActor)
    throw new Error("Import did not retain the authenticated actor");
  const [run] = await db
    .insert(importRuns)
    .values({
      source: "api",
      fileName: "quills-workspace.json",
      initiatedByPrincipalId: currentActor.id,
      status: dryRun ? "dry_run" : "completed",
      totals: {
        rows: count,
        created: count,
        updated: 0,
        skipped: 0,
        errors: 0,
      },
      finishedAt: new Date(),
    })
    .returning();
  if (!dryRun)
    await recordQuillsChange(
      db,
      { ...actor, principalId: currentActor.id },
      {
        type: "workspace.imported",
        entityType: "workspace",
        entityId: actor.workspaceId,
        payload: { runId: run!.id },
      },
    );
  return { runId: run!.id, rows: count, actorId: currentActor.id };
}
