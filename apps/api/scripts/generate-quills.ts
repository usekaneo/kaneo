import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { CONCURRENT_INDEX_SPECS } from "../src/database/quills/schema-ops";
const folder = "drizzle/quills";
let previous: string[] = [];
try {
  previous = readdirSync(folder);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const result = spawnSync(
  process.execPath,
  [
    "node_modules/drizzle-kit/bin.cjs",
    "generate",
    "--config",
    "drizzle.quills.config.ts",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
for (const name of readdirSync(folder).filter(
  (name) => name.endsWith(".sql") && !previous.includes(name),
)) {
  let sql = readFileSync(`${folder}/${name}`, "utf8");
  // A composite SET NULL must leave the non-null workspace discriminator intact.
  sql = sql.replace(
    /FOREIGN KEY \(([^)]+)\)([^;]+?)ON DELETE set null/gi,
    (all, columns: string, rest: string) => {
      const nullable = columns
        .split(",")
        .filter((column) => column.trim() !== '"workspace_id"');
      return columns.includes('"workspace_id"')
        ? `FOREIGN KEY (${columns})${rest}ON DELETE SET NULL (${nullable.join(",")})`
        : all;
    },
  );
  sql = sql.replace(
    /(CREATE TABLE "quills"\."page_views"[\s\S]*?)\n\);/,
    '$1\n) PARTITION BY RANGE ("occurred_at");',
  );
  const created = [...sql.matchAll(/CREATE TABLE "quills"\."([^"]+)"/g)].map(
    (match) => match[1],
  );
  sql = sql
    .split("--> statement-breakpoint")
    .filter(
      (statement) =>
        !CONCURRENT_INDEX_SPECS.some(
          (spec) =>
            spec.concurrent &&
            statement.includes(`CREATE INDEX "${spec.name}"`),
        ),
    )
    .join("--> statement-breakpoint");
  for (const table of created)
    sql += `\n--> statement-breakpoint\nALTER TABLE "quills"."${table}" FORCE ROW LEVEL SECURITY;\n`;
  if (previous.some((file) => file.startsWith("0006_")))
    sql +=
      "\n--> statement-breakpoint\nSELECT quills_migrations.capture_schema_manifest();\n";
  writeFileSync(`${folder}/${name}`, sql);
}
