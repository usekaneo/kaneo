import { and, asc, count, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { personalProjectViewTable as views } from "../database/schema";
import type { z } from "../openapi";
import type { savedViewBody } from "./schema";

type ViewBody = z.infer<typeof savedViewBody>;
const ownedView = (projectId: string, userId: string, id?: string) =>
  and(
    eq(views.projectId, projectId),
    eq(views.userId, userId),
    id ? eq(views.id, id) : undefined,
  );
const selection = {
  id: views.id,
  projectId: views.projectId,
  name: views.name,
  config: views.config,
};

export function listPersonalViews(projectId: string, userId: string) {
  return db
    .select(selection)
    .from(views)
    .where(ownedView(projectId, userId))
    .orderBy(asc(views.name), asc(views.id));
}

export async function createPersonalView(
  projectId: string,
  userId: string,
  body: ViewBody,
) {
  return db.transaction(async (tx) => {
    // Serialize this owner's creates so concurrent requests cannot bypass the cap.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([projectId, userId])}, 0))`,
    );
    const [total] = await tx
      .select({ value: count() })
      .from(views)
      .where(ownedView(projectId, userId));
    if ((total?.value ?? 0) >= 50)
      throw new HTTPException(409, {
        message: "A project can have at most 50 personal views per user",
      });
    const [view] = await tx
      .insert(views)
      .values({ ...body, projectId, userId })
      .returning(selection);
    return view;
  });
}

export async function updatePersonalView(
  projectId: string,
  userId: string,
  id: string,
  body: ViewBody,
) {
  const [view] = await db
    .update(views)
    .set(body)
    .where(ownedView(projectId, userId, id))
    .returning(selection);
  if (!view)
    throw new HTTPException(404, { message: "Personal view not found" });
  return view;
}

export async function deletePersonalView(
  projectId: string,
  userId: string,
  id: string,
) {
  const [view] = await db
    .delete(views)
    .where(ownedView(projectId, userId, id))
    .returning({ id: views.id });
  if (!view)
    throw new HTTPException(404, { message: "Personal view not found" });
  return { success: true as const };
}
