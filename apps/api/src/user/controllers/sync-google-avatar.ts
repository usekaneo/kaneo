import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  accountTable,
  userAvatarTable,
  userTable,
} from "../../database/schema";
import {
  buildAvatarUrl,
  GOOGLE_AVATAR_ID_PREFIX,
  isCustomAvatarUrl,
} from "../avatar";
import {
  extractGooglePictureFromIdToken,
  fetchGoogleAvatar,
  fetchGoogleUserInfoPicture,
} from "../google-avatar";

export async function syncGoogleAvatar({
  userId,
  pictureUrl,
  idToken,
  accessToken,
}: {
  userId: string;
  pictureUrl?: string | null;
  idToken?: string | null;
  accessToken?: string | null;
}): Promise<string | null> {
  const [user] = await db
    .select({ image: userTable.image })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  if (isCustomAvatarUrl(user.image)) {
    return user.image;
  }

  let resolvedIdToken = idToken ?? null;
  let resolvedAccessToken = accessToken ?? null;

  if (!pictureUrl && (!resolvedIdToken || !resolvedAccessToken)) {
    const [account] = await db
      .select({
        idToken: accountTable.idToken,
        accessToken: accountTable.accessToken,
      })
      .from(accountTable)
      .where(
        and(
          eq(accountTable.userId, userId),
          eq(accountTable.providerId, "google"),
        ),
      )
      .limit(1);

    resolvedIdToken = resolvedIdToken ?? account?.idToken ?? null;
    resolvedAccessToken = resolvedAccessToken ?? account?.accessToken ?? null;
  }

  const resolvedPictureUrl =
    pictureUrl?.trim() ||
    extractGooglePictureFromIdToken(resolvedIdToken) ||
    (resolvedAccessToken
      ? await fetchGoogleUserInfoPicture(resolvedAccessToken)
      : null);

  if (!resolvedPictureUrl) {
    return user.image ?? null;
  }

  const downloaded = await fetchGoogleAvatar(resolvedPictureUrl);
  if (!downloaded) {
    return user.image ?? null;
  }

  const [freshUser] = await db
    .select({ image: userTable.image })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!freshUser) {
    return null;
  }

  if (isCustomAvatarUrl(freshUser.image)) {
    return freshUser.image;
  }

  const [existingAvatar] = await db
    .select({
      id: userAvatarTable.id,
      mimeType: userAvatarTable.mimeType,
      data: userAvatarTable.data,
    })
    .from(userAvatarTable)
    .where(eq(userAvatarTable.userId, userId))
    .limit(1);

  if (
    existingAvatar &&
    existingAvatar.id.startsWith(GOOGLE_AVATAR_ID_PREFIX) &&
    existingAvatar.mimeType === downloaded.mimeType &&
    Buffer.from(existingAvatar.data).equals(downloaded.bytes)
  ) {
    const existingUrl = buildAvatarUrl(existingAvatar.id);
    if (freshUser.image !== existingUrl) {
      await db
        .update(userTable)
        .set({ image: existingUrl, updatedAt: new Date() })
        .where(eq(userTable.id, userId));
    }
    return existingUrl;
  }

  const nextAvatarId = `${GOOGLE_AVATAR_ID_PREFIX}${createId()}`;
  const [saved] = await db
    .insert(userAvatarTable)
    .values({
      id: nextAvatarId,
      userId,
      mimeType: downloaded.mimeType,
      size: downloaded.bytes.length,
      data: downloaded.bytes,
    })
    .onConflictDoUpdate({
      target: userAvatarTable.userId,
      set: {
        id: nextAvatarId,
        mimeType: downloaded.mimeType,
        size: downloaded.bytes.length,
        data: downloaded.bytes,
        updatedAt: new Date(),
      },
    })
    .returning({ id: userAvatarTable.id });

  if (!saved) {
    return freshUser.image ?? null;
  }

  const avatarUrl = buildAvatarUrl(saved.id);
  await db
    .update(userTable)
    .set({ image: avatarUrl, updatedAt: new Date() })
    .where(eq(userTable.id, userId));

  return avatarUrl;
}

export default syncGoogleAvatar;
