import type { OrganizationList, Workspace } from "./schemas.js";

function metadataDescription(metadata: unknown): string | null {
  const parsed =
    typeof metadata === "string"
      ? (() => {
          try {
            return JSON.parse(metadata) as unknown;
          } catch {
            return null;
          }
        })()
      : metadata;
  const description = (parsed as { description?: unknown } | null)?.description;
  return typeof description === "string" && description.trim() !== ""
    ? description
    : null;
}

export function fromOrganizations(
  organizations: OrganizationList,
): Workspace[] {
  return organizations
    .map((organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo ?? null,
      description:
        organization.description?.trim() ||
        metadataDescription(organization.metadata),
      createdAt: String(organization.createdAt),
      role: null,
    }))
    .sort(
      (a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||
        a.id.localeCompare(b.id),
    );
}
