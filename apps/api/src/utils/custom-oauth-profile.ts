import type { ManagedProfileField } from "./custom-oauth-env";
import { isHttpUrl } from "./is-http-url";
import { resolveSupportedLocale } from "./supported-locales";

const MAX_PICTURE_URL_LENGTH = 2048;

function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readCustomOAuthPicture(profile: Record<string, unknown>) {
  const picture = stringOrEmpty(profile.picture);
  if (picture.length > MAX_PICTURE_URL_LENGTH || !isHttpUrl(picture)) {
    return null;
  }
  const { href } = new URL(picture);
  return href.length <= MAX_PICTURE_URL_LENGTH ? href : null;
}

export function mapCustomOAuthProfileToUser(
  profile: Record<string, unknown>,
  managedFields: readonly ManagedProfileField[] = [],
) {
  const email = stringOrEmpty(profile.email);
  const nameFromParts = [
    stringOrEmpty(profile.given_name),
    stringOrEmpty(profile.family_name),
  ]
    .filter(Boolean)
    .join(" ");

  const fallbackName = [
    stringOrEmpty(profile.name),
    nameFromParts,
    stringOrEmpty(profile.preferred_username),
    email ? email.split("@")[0] : "",
  ].find(Boolean);

  return {
    ...(fallbackName ? { name: fallbackName } : {}),
    ...(managedFields.includes("image")
      ? { image: readCustomOAuthPicture(profile) ?? undefined }
      : {}),
    ...(managedFields.includes("locale")
      ? { locale: resolveSupportedLocale(profile.locale) }
      : typeof profile.locale === "string"
        ? { locale: profile.locale }
        : {}),
  };
}
