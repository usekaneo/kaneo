import { parseArgs } from "node:util";
import { readFile, writeFile, stat } from "node:fs/promises";
import { z } from "zod";
import { MAX_ARCHIVE_BYTES } from "../src/quills/transfer/archive";

const { values } = parseArgs({
  options: {
    mode: { type: "string" },
    workspace: { type: "string" },
    user: { type: "string" },
    file: { type: "string" },
    mapping: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const options = z
  .object({
    mode: z.enum(["export", "export-legacy", "import"]),
    workspace: z.string().min(1).optional(),
    user: z.string().min(1).optional(),
    file: z.string().min(1),
    mapping: z.string().optional(),
    "dry-run": z.boolean(),
  })
  .parse(values);
async function readJson(file: string) {
  if ((await stat(file)).size > MAX_ARCHIVE_BYTES)
    throw new Error("Workspace archive exceeds 64 MiB");
  return JSON.parse(await readFile(file, "utf8"));
}
async function main() {
  if (options.mode === "export-legacy") {
    const url = process.env.QUILLS_SOURCE_DATABASE_URL;
    if (!url) throw new Error("QUILLS_SOURCE_DATABASE_URL is required");
    const { exportLegacyArchive } =
      await import("../src/quills/transfer/legacy-archive");
    await writeFile(
      options.file,
      JSON.stringify(await exportLegacyArchive(url)),
      { mode: 0o600, flag: "wx" },
    );
    return;
  }
  const url = process.env.QUILLS_TRANSFER_DATABASE_URL;
  if (!url) throw new Error("QUILLS_TRANSFER_DATABASE_URL is required");
  if (!options.workspace || !options.user)
    throw new Error("--workspace and --user are required");
  process.env.DATABASE_URL = url;
  const { default: db, getDatabasePool } = await import("../src/database");
  const { withQuillsWorkspace } = await import("../src/database/quills/client");
  const { sql } = await import("drizzle-orm");
  const { roleHasWorkspacePermission } =
    await import("../src/utils/require-workspace-permission");
  try {
    const member = (
      await db.execute<{ role: string }>(
        sql`SELECT role FROM public.workspace_member WHERE workspace_id=${options.workspace} AND user_id=${options.user}`,
      )
    ).rows[0];
    if (
      !member ||
      !(await roleHasWorkspacePermission(options.workspace, member.role, {
        workspace: ["read"],
        quills: ["manage_settings"],
      }))
    )
      throw new Error(
        "The operator must be a current member with quills:manage_settings",
      );
    const context = { workspaceId: options.workspace, userId: options.user };
    if (options.mode === "export") {
      const { exportWorkspaceArchive } =
        await import("../src/quills/transfer/archive");
      const archive = await withQuillsWorkspace(
        context,
        (tx) => exportWorkspaceArchive(tx, options.workspace!),
        { snapshot: true },
      );
      await writeFile(options.file, JSON.stringify(archive), {
        mode: 0o600,
        flag: "wx",
      });
      return;
    }
    const { prepareArchive, importWorkspaceArchive } =
      await import("../src/quills/transfer/import-archive");
    const members = (
      await db.execute<{ id: string; name: string; image: string | null }>(
        sql`SELECT u.id,u.name,u.image FROM public."user" u JOIN public.workspace_member m ON m.user_id=u.id WHERE m.workspace_id=${options.workspace}`,
      )
    ).rows;
    const workspace = (
      await db.execute<{ name: string; slug: string }>(
        sql`SELECT name,slug FROM public.workspace WHERE id=${options.workspace}`,
      )
    ).rows[0];
    if (!workspace) throw new Error("Workspace not found");
    const archive = prepareArchive(
      await readJson(options.file),
      options.mapping ? await readJson(options.mapping) : {},
      options.workspace,
      members,
    );
    const rollback = new Error("Validated dry run");
    let rows = 0;
    try {
      await withQuillsWorkspace(
        context,
        async (tx, actor) => {
          rows = (
            await importWorkspaceArchive(
              tx,
              actor,
              archive,
              members,
              workspace,
              options["dry-run"],
            )
          ).rows;
          if (options["dry-run"]) throw rollback;
        },
        { exclusiveWorkspace: true },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
    console.log(
      JSON.stringify({
        mode: options["dry-run"] ? "validated-and-rolled-back" : "imported",
        rows,
      }),
    );
  } finally {
    await getDatabasePool().end();
  }
}
await main().catch((error: unknown) => {
  // Query errors can contain the full private archive. Do not print their payloads.
  const message = error instanceof Error ? error.message : "";
  const safe =
    /^(QUILLS_(SOURCE|TRANSFER)_DATABASE_URL is required|--workspace and --user are required|The operator must|Workspace not found|Target workspace|Explicit .* mapping|Unsupported archive table|Unknown archive column|Workspace archive exceeds|Archive row limit|Source is not)/.test(
      message,
    );
  console.error(
    safe
      ? message.replace(/[\r\n]/g, " ").slice(0, 300)
      : "Workspace transfer failed. Inspect the target before retrying; check the archive, mappings, database and storage configuration.",
  );
  process.exitCode = 1;
});
