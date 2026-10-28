import { count, eq } from "drizzle-orm";
import { integrationTable } from "../../database/schema";
import { integrationPlugins } from "../../plugins";
import { resolveGithubPrivateKey } from "../../plugins/github/utils/github-app";
import { credentialSetStatus } from "./credential-set-status";
import type { ServiceStatus } from "./service-status";
import { withDatabaseTimeout } from "./with-database-timeout";

type IntegrationProvider = {
  type: string;
  name: string;
  status: ServiceStatus;
  requiresInstanceSetup: boolean;
  connectedProjects: number | null;
};

// Only the GitHub App is set up on the instance. Every other provider is
// connected per project with that project's own credentials.
function instanceSetupStatus(type: string): ServiceStatus | null {
  if (type !== "github") return null;
  return credentialSetStatus([
    process.env.GITHUB_APP_ID,
    process.env.GITHUB_WEBHOOK_SECRET,
    resolveGithubPrivateKey(),
  ]);
}

async function countConnectedProjects(timeoutMs: number) {
  try {
    const rows = await withDatabaseTimeout(
      async (tx) =>
        tx
          .select({ type: integrationTable.type, value: count() })
          .from(integrationTable)
          .where(eq(integrationTable.isActive, true))
          .groupBy(integrationTable.type),
      timeoutMs,
    );
    return new Map(rows.map((row) => [row.type, row.value]));
  } catch {
    return null;
  }
}

export async function listIntegrationProviders(
  timeoutMs: number,
): Promise<IntegrationProvider[]> {
  // Without the database the providers are still listed, with unknown counts.
  const connected = await countConnectedProjects(timeoutMs);

  return integrationPlugins.map(({ type, name }) => {
    const setup = instanceSetupStatus(type);
    return {
      type,
      name,
      status: setup ?? "ok",
      requiresInstanceSetup: setup !== null,
      connectedProjects: connected ? (connected.get(type) ?? 0) : null,
    };
  });
}
