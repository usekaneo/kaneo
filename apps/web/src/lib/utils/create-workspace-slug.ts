import { createSlug } from "./create-slug";

const RANDOM_SUFFIX_LENGTH = 12;

const RESERVED_WORKSPACE_SLUGS = new Set([
  ".",
  "..",
  ".well-known",
  "api",
  "assets",
  "auth",
  "dashboard",
  "device",
  "images",
  "invitation",
  "invitations",
  "mcp",
  "onboarding",
  "profile-setup",
  "public-project",
  "test-error",
]);

export function isReservedWorkspaceSlug(slug: string): boolean {
  return RESERVED_WORKSPACE_SLUGS.has(slug.toLowerCase());
}

export function createWorkspaceBaseSlug(value: string): string {
  return createSlug(value) || "workspace";
}

// getRandomValues, unlike randomUUID, also works on plain-HTTP origins.
function createRandomSuffix(): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(RANDOM_SUFFIX_LENGTH / 2),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function createUniqueWorkspaceSlug(
  value: string,
  existingSlugs: Iterable<string | null | undefined>,
): string {
  const baseSlug = createWorkspaceBaseSlug(value);
  const usedSlugs = new Set(
    Array.from(existingSlugs, (slug) => slug?.toLowerCase()).filter(Boolean),
  );

  if (
    !usedSlugs.has(baseSlug.toLowerCase()) &&
    !isReservedWorkspaceSlug(baseSlug)
  ) {
    return baseSlug;
  }

  let slug = `${baseSlug}-${createRandomSuffix()}`;

  while (usedSlugs.has(slug.toLowerCase())) {
    slug = `${baseSlug}-${createRandomSuffix()}`;
  }

  return slug;
}

export function isWorkspaceSlugCollisionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("already exists") ||
    message.includes("workspace exists") ||
    message.includes("slug")
  );
}
