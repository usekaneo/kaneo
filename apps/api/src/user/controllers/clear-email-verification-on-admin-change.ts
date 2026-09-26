import { eq } from "drizzle-orm";
import db, { schema } from "../../database";

type UpdateHookContext = {
  path?: string;
  body?: { userId?: unknown };
};

export async function clearEmailVerificationOnAdminChange(
  data: Record<string, unknown>,
  ctx: UpdateHookContext | null | undefined,
) {
  if (ctx?.path !== "/admin/update-user" || !("email" in data)) {
    return;
  }
  const userId = ctx.body?.userId;
  if (typeof userId !== "string") {
    return;
  }
  const [current] = await db
    .select({ email: schema.userTable.email })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  if (!current) {
    return;
  }
  const nextEmail = String(data.email ?? "")
    .trim()
    .toLowerCase();
  if (nextEmail === current.email.trim().toLowerCase()) {
    return;
  }
  return { data: { ...data, emailVerified: false } };
}

export default clearEmailVerificationOnAdminChange;
