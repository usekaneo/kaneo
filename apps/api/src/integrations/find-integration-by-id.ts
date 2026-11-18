import { and, eq } from "drizzle-orm";
import db from "../database";
import { integrationTable } from "../database/schema";

// RFC 0001 WP2/WP3/WP4: provider-specific routes look up bindings by primary
// key. The integration table holds every provider in one place, so a lookup
// constrained by id alone would let a GitHub route read, update, or delete a
// Gitea, GitLab, Slack, or webhook row from the same workspace. Every
// provider-specific get, update, and delete therefore constrains both the
// id and the route's expected integration type; a foreign row reads as 404.

export type ProviderIntegrationType = "github" | "gitea" | "gitlab";

export function findIntegrationByIdAndType(
  integrationId: string,
  type: ProviderIntegrationType,
) {
  return db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.id, integrationId),
      eq(integrationTable.type, type),
    ),
  });
}
