import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { contactOptionTable } from "../../database/schema";
import { createId } from "@paralleldrive/cuid2";
import { type ContactOptionKind, MAX_OPTIONS_PER_KIND } from "./defaults";
import { ensureDefaultOptions } from "./ensure-default-options";
import { lockKind } from "./lock-kind";
import { normalizeLabels } from "./normalize-labels";

type CreateOptionsInput = {
  workspaceId: string;
  kind: ContactOptionKind;
  label?: string;
  labels?: string[];
};

// Adds names to the end of the list. Names that exist already (ignoring case)
// or repeat within the request are skipped rather than rejected, so pasting an
// overlapping list is harmless.
async function createOptions({
  workspaceId,
  kind,
  label,
  labels,
}: CreateOptionsInput) {
  await ensureDefaultOptions(workspaceId);
  const requested = normalizeLabels([
    ...(label === undefined ? [] : [label]),
    ...(labels ?? []),
  ]);

  return db.transaction(async (tx) => {
    const existing = await lockKind(tx, workspaceId, kind);
    const taken = new Set(existing.map((option) => option.label.toLowerCase()));
    const skipped = [...requested.repeated];
    const fresh: string[] = [];
    for (const name of requested.labels) {
      (taken.has(name.toLowerCase()) ? skipped : fresh).push(name);
    }

    if (existing.length + fresh.length > MAX_OPTIONS_PER_KIND) {
      throw new HTTPException(400, {
        message: `A list can hold at most ${MAX_OPTIONS_PER_KIND} options; ${Math.max(0, MAX_OPTIONS_PER_KIND - existing.length)} more can be added`,
      });
    }
    if (fresh.length === 0) return { created: [], skipped };

    const first =
      Math.max(-1, ...existing.map((option) => option.position)) + 1;
    // Conflicts are only possible if the database folds case differently than
    // JavaScript does; those names are reported as skipped.
    const inserted = await tx
      .insert(contactOptionTable)
      .values(
        fresh.map((name, index) => ({
          workspaceId,
          kind,
          key: createId(),
          label: name,
          position: first + index,
        })),
      )
      .onConflictDoNothing()
      .returning();
    const added = new Set(inserted.map((option) => option.label));
    skipped.push(...fresh.filter((name) => !added.has(name)));

    return {
      created: inserted
        .sort((a, b) => a.position - b.position)
        .map(({ key, label: name, position }) => ({
          key,
          label: name,
          position,
          contactCount: 0,
        })),
      skipped,
    };
  });
}

export default createOptions;
