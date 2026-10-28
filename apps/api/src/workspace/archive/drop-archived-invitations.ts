import { and, inArray, isNotNull } from "drizzle-orm";
import db, { schema } from "../../database";

/** Removes, in place, invitations whose workspace is archived. */
export async function dropArchivedInvitations(
  invitations: { organizationId?: unknown }[],
) {
  const ids = [
    ...new Set(
      invitations.flatMap((invitation) =>
        typeof invitation.organizationId === "string"
          ? [invitation.organizationId]
          : [],
      ),
    ),
  ];
  if (ids.length === 0) return;
  const archived = await db
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(
      and(
        inArray(schema.workspaceTable.id, ids),
        isNotNull(schema.workspaceTable.archivedAt),
      ),
    );
  if (archived.length === 0) return;
  const hidden = new Set(archived.map((row) => row.id));
  invitations.splice(
    0,
    invitations.length,
    ...invitations.filter(
      (invitation) => !hidden.has(invitation.organizationId as string),
    ),
  );
}
