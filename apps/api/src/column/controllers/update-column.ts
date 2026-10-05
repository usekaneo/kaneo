import { eq, and, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getProjectSubtaskParentProjects } from "../../task/get-subtask-parent-projects";
import { VIRTUAL_STATUSES } from "../../task/validate-task-fields";
import { toSlug } from "./create-column";

async function updateColumn(
  id: string,
  data: {
    name?: string;
    icon?: string | null;
    color?: string | null;
    isFinal?: boolean;
  },
) {
  const existing = await db.query.columnTable.findFirst({
    where: eq(columnTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Column not found" });
  }

  let newSlug: string | undefined;

  if (data.name !== undefined && data.name !== existing.name) {
    const slug = toSlug(data.name);

    if (!slug) {
      throw new HTTPException(400, {
        message: "Column name must contain at least one alphanumeric character",
      });
    }

    if ((VIRTUAL_STATUSES as readonly string[]).includes(slug)) {
      throw new HTTPException(409, {
        message: `Column slug "${slug}" is reserved for virtual task statuses`,
      });
    }

    if (slug !== existing.slug) {
      const conflict = await db.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, existing.projectId),
          eq(columnTable.slug, slug),
          ne(columnTable.id, id),
        ),
      });

      if (conflict) {
        throw new HTTPException(409, {
          message: `Column with slug "${slug}" already exists in this project`,
        });
      }

      newSlug = slug;
    }
  }

  const [updated] = await db
    .update(columnTable)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(newSlug !== undefined && { slug: newSlug }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.isFinal !== undefined && { isFinal: data.isFinal }),
    })
    .where(eq(columnTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update column" });
  }

  if (existing.isFinal !== updated.isFinal) {
    const parents = await getProjectSubtaskParentProjects(
      updated.projectId,
      updated.slug,
    );
    await publishEvent("subtask-parents.refresh", {
      projects: [
        { projectId: updated.projectId },
        ...parents.filter((p) => p.projectId !== updated.projectId),
      ],
    });
  }

  await publishEvent("project.updated", { projectId: updated.projectId });

  return updated;
}

export default updateColumn;
