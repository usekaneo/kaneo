import type { ManagedProfileField } from "../utils/custom-oauth-env";
import {
  mapCustomOAuthProfileToUser,
  readCustomOAuthPicture,
} from "../utils/custom-oauth-profile";
import { resolveSupportedLocale } from "../utils/supported-locales";
import { isUploadedAvatarUrl } from "./avatar";

export type StoredProfile = {
  name: string;
  image: string | null;
  locale: string | null;
};

export const PROFILE_FIELD_MANAGED_BY_PROVIDER = {
  code: "PROFILE_FIELD_MANAGED_BY_PROVIDER",
  message:
    "Profile fields managed by the identity provider cannot be changed in Kaneo.",
} as const;

// An upload made in Kaneo can still be withdrawn, but never replaced.
export function canRemoveAvatar(image: string | null) {
  return image === null || isUploadedAvatarUrl(image);
}

export function changesManagedProfile(
  data: Record<string, unknown>,
  stored: StoredProfile,
  fields: readonly ManagedProfileField[],
) {
  return fields.some((field) => {
    const next = data[field];
    if (next === undefined || next === stored[field]) return false;
    return !(
      field === "image" &&
      next === null &&
      canRemoveAvatar(stored.image)
    );
  });
}

export function planManagedProfileRefresh(
  profile: Record<string, unknown>,
  stored: StoredProfile,
  fields: readonly ManagedProfileField[],
) {
  const update: Partial<StoredProfile> = {};
  let removeUploadedAvatar = false;

  if (fields.includes("name")) {
    const { name } = mapCustomOAuthProfileToUser(profile);
    if (name && name !== stored.name) update.name = name;
  }

  if (fields.includes("image")) {
    const picture = readCustomOAuthPicture(profile);
    if (picture) {
      if (picture !== stored.image) update.image = picture;
      removeUploadedAvatar = true;
    } else if (stored.image !== null && !isUploadedAvatarUrl(stored.image)) {
      update.image = null;
    }
  }

  if (fields.includes("locale")) {
    const locale = resolveSupportedLocale(profile.locale);
    if (locale && locale !== stored.locale) update.locale = locale;
  }

  return { update, removeUploadedAvatar };
}
