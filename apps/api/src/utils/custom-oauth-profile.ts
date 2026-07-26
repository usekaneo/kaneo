function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function mapCustomOAuthProfileToUser(profile: Record<string, unknown>) {
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

  return fallbackName ? { name: fallbackName } : {};
}
