import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

const RANDOM_SUFFIX_LENGTH = 12;

const RESERVED_SLUGS = new Set([
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

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function randomSlugSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, RANDOM_SUFFIX_LENGTH);
}

export function deriveWorkspaceSlug(
  name: string,
  taken: Iterable<string>,
  random: () => string = randomSlugSuffix,
): string {
  const base = slugify(name) || "workspace";
  const used = new Set(Array.from(taken, (slug) => slug.toLowerCase()));
  if (!used.has(base) && !isReservedSlug(base)) return base;
  let slug = `${base}-${random()}`;
  while (used.has(slug)) slug = `${base}-${random()}`;
  return slug;
}

export function checkWorkspaceSlug(
  input: string,
): Result.Result<string, InvalidArgument> {
  const slug = input.trim();
  const suggestion = slugify(slug);
  if (slug === "" || slug !== suggestion) {
    return Result.fail(
      new InvalidArgument({
        message: `"${input}" is not a valid workspace slug.`,
        hint:
          suggestion === ""
            ? "Use lowercase letters, numbers and hyphens, for example acme-studio."
            : `Use lowercase letters, numbers and hyphens, for example ${suggestion}.`,
      }),
    );
  }
  if (isReservedSlug(slug)) {
    return Result.fail(
      new InvalidArgument({
        message: `"${slug}" is reserved by Kaneo.`,
        hint: "Choose another slug.",
      }),
    );
  }
  return Result.succeed(slug);
}
