import type { externalLinkTable } from "../../database/schema";

type ExternalLink = Omit<typeof externalLinkTable.$inferSelect, "metadata"> & {
  metadata: Record<string, unknown> | null;
};

export function publicExternalLink(link: ExternalLink): ExternalLink {
  const metadata: Record<string, unknown> = {};
  const state = link.metadata?.state;
  if (state === "open" || state === "opened" || state === "closed") {
    metadata.state = state;
  }
  for (const flag of ["merged", "draft"] as const) {
    if (typeof link.metadata?.[flag] === "boolean") {
      metadata[flag] = link.metadata[flag];
    }
  }

  // Sync metadata can retain earlier task contents. Public boards only expose
  // the link's display fields; new database/provider fields stay private.
  return {
    id: link.id,
    taskId: link.taskId,
    integrationId: null,
    resourceType: link.resourceType,
    externalId: link.externalId,
    url: link.url,
    title: link.title,
    metadata: Object.keys(metadata).length ? metadata : null,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}
