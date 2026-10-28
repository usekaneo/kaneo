import type { ExternalLink } from "../api/external-links.js";

export type LinkJson = {
  readonly id: string;
  readonly url: string;
  readonly title: string | null;
  readonly source: string;
  readonly resourceType: string;
  readonly removable: boolean;
  readonly createdAt: string;
};

export function isManualLink(link: ExternalLink): boolean {
  return link.integrationId === null && link.resourceType === "url";
}

export function toLinkJson(link: ExternalLink): LinkJson {
  return {
    id: link.id,
    url: link.url,
    title: link.title,
    source: isManualLink(link)
      ? "manual"
      : (link.integration?.type ?? "integration"),
    resourceType: link.resourceType,
    removable: isManualLink(link),
    createdAt: link.createdAt,
  };
}
