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

function createRandomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, RANDOM_SUFFIX_LENGTH);
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
