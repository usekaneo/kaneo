import { createId } from "@paralleldrive/cuid2";
import db from "../../database";
import { userAvatarTable } from "../../database/schema";
import { buildAvatarUrl, decodeAvatarUpload } from "../avatar";

export async function saveAvatar({
  userId,
  contentType,
  data,
}: {
  userId: string;
  contentType: string;
  data: string;
}) {
  const { mimeType, bytes } = decodeAvatarUpload({ contentType, data });

  const [saved] = await db
    .insert(userAvatarTable)
    .values({
      userId,
      mimeType,
      size: bytes.length,
      data: bytes,
    })
    .onConflictDoUpdate({
      target: userAvatarTable.userId,
      set: {
        id: createId(),
        mimeType,
        size: bytes.length,
        data: bytes,
        updatedAt: new Date(),
      },
    })
    .returning({ id: userAvatarTable.id });

  if (!saved) {
    throw new Error("Failed to store avatar");
  }

  return { id: saved.id, url: buildAvatarUrl(saved.id), size: bytes.length };
}

export default saveAvatar;
