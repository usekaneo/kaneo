import { asc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function reorderProjects(
  workspaceId: string,
  projects: Array<{ id: string; position: number }>,
) {
  const ids = projects.map((project) => project.id);
  const uniqueIds = new Set(ids);

  if (uniqueIds.size !== ids.length) {
    throw new HTTPException(400, {
      message: "Duplicate project ids in reorder payload",
    });
  }

  return db.transaction(async (tx) => {
    // Serialize ordering writes per workspace so a concurrent create (which
    // appends at max(position) + 1) cannot interleave with a renumber.
    // `createProject` takes the same lock with the same key.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
    );

    // The whole workspace, not just the payload: the client only ever sees
    // non-archived projects, so archived ones have to hold their place in the
    // ordering without being sent. Ordering here defines each project's current
    // rank, which is what the renumbering below pins them to.
    const existing = await tx
      .select({ id: projectTable.id, position: projectTable.position })
      .from(projectTable)
      .where(eq(projectTable.workspaceId, workspaceId))
      .orderBy(
        asc(projectTable.position),
        asc(projectTable.createdAt),
        asc(projectTable.id),
      );

    // Verify ownership of the whole batch before writing anything, so a
    // smuggled foreign id cannot leave the workspace half-renumbered.
    const ownedIds = new Set(existing.map((project) => project.id));
    const foreignId = ids.find((id) => !ownedIds.has(id));

    if (foreignId) {
      throw new HTTPException(400, {
        message: `Project ${foreignId} does not belong to this workspace`,
      });
    }

    // Positions are derived server-side rather than trusted from the client:
    // the payload only expresses a relative order. This keeps stored positions
    // in 0..n-1, so they can't drift out of the integer column's range and
    // can't develop duplicates or gaps.
    const requestedOrder = [...projects]
      .sort((a, b) => a.position - b.position)
      .map((project) => project.id);
    const requestedIds = new Set(requestedOrder);

    // Projects the payload omits keep the rank they already hold, and the
    // payload fills the slots around them in the order it asked for. Appending
    // them instead would sink an archived project to the bottom of the
    // workspace the first time anyone dragged a visible one.
    const requested = requestedOrder[Symbol.iterator]();
    const finalOrder = existing.map((project) =>
      requestedIds.has(project.id)
        ? // Every requested id was matched against `existing` above, so the
          // slots and the payload are the same length and this never falls back.
          (requested.next().value ?? project.id)
        : project.id,
    );

    const currentPositions = new Map(
      existing.map((project) => [project.id, project.position]),
    );

    for (const [position, id] of finalOrder.entries()) {
      if (currentPositions.get(id) === position) continue;

      await tx
        .update(projectTable)
        .set({ position })
        .where(eq(projectTable.id, id));
    }

    return tx.query.projectTable.findMany({
      where: eq(projectTable.workspaceId, workspaceId),
      orderBy: [
        asc(projectTable.position),
        asc(projectTable.createdAt),
        asc(projectTable.id),
      ],
    });
  });
}

export default reorderProjects;
