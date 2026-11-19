#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const JOURNAL_PATH = resolve(ROOT, "apps/api/drizzle/meta/_journal.json");
const MIGRATIONS_DIR = resolve(ROOT, "apps/api/drizzle");

// The Drizzle migrator applies only migrations whose `when` is greater than
// the newest timestamp recorded in drizzle.__drizzle_migrations. An entry
// dated before an already-published migration is therefore silently skipped
// on every upgraded installation, leaving its schema changes missing.
//
// Three published entries (0006, 0025, 0026) predate that convention and
// are skipped-by-timestamp on any database that applied their neighbours.
// From 0027 onwards the published history is strictly monotonic, and every
// new entry must keep it that way. PR #2242 review finding 9 ships this
// guard so replacing a published journal entry can never reach main
// unnoticed again.
const LEGACY_CUTOFF_IDX = 27;
const LEGACY_NOTE =
  "entries before idx 27 predate the monotonic convention (0006, 0025, 0026)";

const violations = [];

function fail() {
  for (const violation of violations)
    console.error(`drizzle journal check: ${violation}`);
  process.exit(1);
}

const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));
if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
  violations.push("the journal has no entries");
  fail();
}

let newestWhen = null;
let newestTag = null;
for (const [index, entry] of journal.entries.entries()) {
  if (entry.idx !== index) {
    violations.push(
      `${entry.tag}: idx ${entry.idx} does not match its position ${index}`,
    );
  }
  if (!Number.isInteger(entry.when) || entry.when <= 0) {
    violations.push(`${entry.tag}: 'when' must be a positive integer`);
    continue;
  }
  if (!existsSync(resolve(MIGRATIONS_DIR, `${entry.tag}.sql`))) {
    violations.push(`${entry.tag}: missing migration file ${entry.tag}.sql`);
  }
  if (
    index >= LEGACY_CUTOFF_IDX &&
    newestWhen !== null &&
    entry.when <= newestWhen
  ) {
    violations.push(
      `${entry.tag}: 'when' ${entry.when} is not greater than the newest published entry ${newestTag} (${newestWhen}); the migrator would silently skip it on upgraded databases`,
    );
  }
  if (newestWhen === null || entry.when > newestWhen) {
    newestWhen = entry.when;
    newestTag = entry.tag;
  }
}

// PR #2242 review finding "A stray migration file never runs": the migrator
// applies only journaled tags, so an .sql file without a journal entry is
// silently dead code. Once its number slot is published by another entry, it
// can never be added without renumbering. Every migration file (forward or
// rollback) must therefore have its forward form in the journal.
const journaledTags = new Set(journal.entries.map((entry) => entry.tag));
for (const file of readdirSync(MIGRATIONS_DIR)) {
  if (!file.endsWith(".sql")) continue; // meta/ directory and other files
  const isRollback = file.endsWith(".down.sql");
  const base = file.slice(
    0,
    file.length - (isRollback ? ".down.sql" : ".sql").length,
  );
  if (!journaledTags.has(base)) {
    violations.push(
      `${file}: migration file has no journal entry and would never run`,
    );
  }
}

if (violations.length > 0) fail();

console.log(
  `drizzle journal check: ${journal.entries.length} entries are consistent; every migration since idx ${LEGACY_CUTOFF_IDX} is newer than the published history (${LEGACY_NOTE})`,
);
