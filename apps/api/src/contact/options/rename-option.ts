import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { contactOptionTable } from "../../database/schema";
import { countContactsUsing } from "./count-contacts";
import type { ContactOptionKind } from "./defaults";
import { ensureDefaultOptions } from "./ensure-default-options";
import { lockKind } from "./lock-kind";
import { normalizeLabel } from "./normalize-labels";

function isUniqueViolation(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } })?.code;
  const causeCode = (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

// Only the label changes; contacts store the key, so they stay linked.
async function renameOption(
  workspaceId: string,
  kind: ContactOptionKind,
  key: string,
  newLabel: string,
) {
  await ensureDefaultOptions(workspaceId);
  const label = normalizeLabel(newLabel);
  if (!label) throw new HTTPException(400, { message: "Label is required" });

  const option = await db.transaction(async (tx) => {
    const options = await lockKind(tx, workspaceId, kind);
    const target = options.find((candidate) => candidate.key === key);
    if (!target) throw new HTTPException(404, { message: "Option not found" });
    const clash = options.some(
      (candidate) =>
        candidate.key !== key &&
        candidate.label.toLowerCase() === label.toLowerCase(),
    );
    if (clash) {
      throw new HTTPException(409, {
        message: `Another ${kind} is already called "${label}"`,
      });
    }
    if (target.label === label) return target;
    try {
      const [updated] = await tx
        .update(contactOptionTable)
        .set({ label })
        .where(eq(contactOptionTable.id, target.id))
        .returning();
      return updated ?? target;
    } catch (error) {
      // PostgreSQL folds case differently from JavaScript for some letters.
      if (isUniqueViolation(error)) {
        throw new HTTPException(409, {
          message: `Another ${kind} is already called "${label}"`,
        });
      }
      throw error;
    }
  });

  return {
    key: option.key,
    label: option.label,
    position: option.position,
    contactCount: await countContactsUsing(workspaceId, kind, key),
  };
}

export default renameOption;
