import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { parseManagedProfileFields } from "../../utils/custom-oauth-env";
import { planManagedProfileRefresh } from "../managed-profile";
import deleteAvatar from "./delete-avatar";

export async function refreshManagedProfile(
  userId: string,
  profile: Record<string, unknown>,
) {
  const fields = parseManagedProfileFields();
  if (fields.length === 0) return;

  const [stored] = await db
    .select({
      name: userTable.name,
      image: userTable.image,
      locale: userTable.locale,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!stored) return;

  const { update, removeUploadedAvatar } = planManagedProfileRefresh(
    profile,
    stored,
    fields,
  );
  if (Object.keys(update).length > 0) {
    await db.update(userTable).set(update).where(eq(userTable.id, userId));
  }
  if (removeUploadedAvatar) await deleteAvatar(userId);
}

export default refreshManagedProfile;
