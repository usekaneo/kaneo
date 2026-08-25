import { responseTimestamp, z } from "../openapi";

export const externalLinkSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    integrationId: z.string(),
    resourceType: z.string().openapi({
      description:
        "The kind of remote resource, e.g. `issue` or `pull_request`.",
    }),
    externalId: z.string().openapi({
      description: "The provider's own identifier for the linked resource.",
    }),
    url: z.string(),
    title: z.string().nullable(),
    metadata: z.unknown().nullable().openapi({
      description:
        "Provider-specific payload, parsed from the stored JSON string. Null when the link has no metadata.",
    }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    // The route selects only id/type here on purpose: integration.config holds
    // plaintext provider secrets and any workspace member can read this route.
    integration: z
      .object({ id: z.string(), type: z.string() })
      .openapi("ExternalLinkIntegration"),
  })
  .openapi("ExternalLink");

export const externalLinkListSchema = z.array(externalLinkSchema);
