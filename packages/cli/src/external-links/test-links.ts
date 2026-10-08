import type { ExternalLink } from "../api/external-links.js";

export function externalLink(
  overrides: Partial<ExternalLink> & { readonly id: string },
): ExternalLink {
  return {
    taskId: "t1",
    integrationId: null,
    resourceType: "url",
    url: `https://example.com/${overrides.id}`,
    title: null,
    createdAt: "2026-10-08T10:00:00.000Z",
    ...overrides,
  };
}
