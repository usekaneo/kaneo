function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function mapCustomOAuthProfileToUser(
  profile: Record<string, unknown>,
  options: { assumeEmailVerified?: boolean } = {},
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
  const shouldMapEmailVerification =
    options.assumeEmailVerified === true && Boolean(email);
  const emailVerified =
    profile.email_verified === undefined || profile.email_verified === true;

  return {
    ...(fallbackName ? { name: fallbackName } : {}),
    ...(shouldMapEmailVerification ? { emailVerified } : {}),
  };
}
