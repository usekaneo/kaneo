import { z } from "../openapi";
import { MANAGED_PROFILE_FIELDS } from "../utils/custom-oauth-env";

export const avatarSchema = z
  .object({
    id: z.string(),
    url: z.string().openapi({
      description:
        "Public URL for the stored avatar, served from /api/user/avatar/{id}.",
    }),
    size: z.number().openapi({ description: "Decoded size in bytes." }),
  })
  .openapi("UserAvatar");

export const avatarDeletedSchema = z
  .object({
    deleted: z.boolean().openapi({
      description: "False when the user had no uploaded avatar to remove.",
    }),
  })
  .openapi("UserAvatarDeleted");

export const currentUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string().nullable(),
    telegramHandle: z.string().nullable().openapi({
      description:
        "The user's normalized Telegram username (without @) or numeric user ID, used for assignee mentions. Null when unset.",
    }),
    managedProfileFields: z.array(z.enum(MANAGED_PROFILE_FIELDS)).openapi({
      description:
        "Profile fields the custom OAuth/OIDC provider manages for this user. Kaneo updates them at sign-in and refuses changes to them.",
    }),
  })
  .openapi("CurrentUser");
